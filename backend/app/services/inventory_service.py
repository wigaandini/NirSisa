# Inventory Management Service
# Logika untuk pengelolaan inventaris bahan makanan:
# - CRUD operasi dengan normalisasi otomatis
# - Estimasi kedaluwarsa untuk bahan alami
# - Inventory Reconciliation (pengurangan stok setelah masak)
# - Pencatatan riwayat konsumsi

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Optional # Pastikan Optional diimport


from app.core.supabase import get_supabase
from app.services.normalizer import (
    normalize_ingredient_name,
    estimate_expiry_date,
    resolve_category_from_shelf_life,
)
from app.ai.spi import days_until_expiry, calculate_spi, freshness_status

logger = logging.getLogger(__name__)


# Inventory CRUD helpers

def enrich_inventory_item(item: dict[str, Any]) -> dict[str, Any]:
    # Tambahkan field kalkulasi: days_remaining, spi_score, freshness_status 
    expiry = item.get("expiry_date")
    if expiry and isinstance(expiry, str):
        expiry = date.fromisoformat(expiry)

    d_remaining = days_until_expiry(expiry) if expiry else None
    spi = calculate_spi(d_remaining) if d_remaining is not None else None
    status = freshness_status(d_remaining)

    item["days_remaining"] = d_remaining
    item["spi_score"] = round(spi, 6) if spi is not None else None
    item["freshness_status"] = status
    return item

def get_category_id_from_name(name: str) -> Optional[int]:
    # Mapping dari Label UI (Frontend) ke ID Database (berdasarkan screenshot Anda)
    mapping = {
        "Sayuran": 1,           # sayur
        "Buah-Buahan": 2,       # buah
        "Daging Sapi": 3,       # daging_sapi
        "Daging Ayam": 4,       # daging_ayam
        "Daging Kambing": 5,    # daging_kambing
        "Ikan": 6,              # ikan_segar
        "Udang": 7,             # udang
        "Telur": 8,             # telur
        "Tahu": 9,              # tahu
        "Tempe": 10,            # tempe
        "Susu & Olahan": 11,    # dairy
        "Bumbu Segar": 12,      # bumbu_segar
        "Bumbu Kering": 13,     # bumbu_kering
        "Produk Jadi": 14,      # bahan_olahan
        "Minyak & Lemak": 15,   # minyak_lemak
        "Tepung": 16,           # tepung_kering
        "Kacang-kacangan": 17,  # kacang_biji
        "Roti & Bakery": 18,    # roti_bakery
    }
    return mapping.get(name)


def prepare_insert_row(
    user_id: str,
    item_name: str,
    quantity: float,
    unit: str,
    is_natural: bool,
    expiry_date: date | None,
    category_name: Optional[str] = None, # <--- TAMBAHKAN PARAMETER INI
) -> dict[str, Any]:
    
    normalized = normalize_ingredient_name(item_name)
    
    # LOGIKA BARU: 
    # Jika user memilih kategori di HP, kita cari ID-nya. 
    # Jika tidak memilih, baru gunakan fungsi pencarian otomatis (AI/Lookup).
    category_id = None
    if category_name:
        category_id = get_category_id_from_name(category_name)
    
    if not category_id:
        category_id = resolve_category_from_shelf_life(normalized)

    row: dict[str, Any] = {
        "user_id": user_id,
        "item_name": item_name.strip(),
        "item_name_normalized": normalized,
        "quantity": quantity,
        "unit": unit,
        "is_natural": is_natural,
    }

    if category_id:
        row["category_id"] = category_id

    # Logika Expiry tetap sama
    if expiry_date:
        row["expiry_date"] = expiry_date.isoformat()
    elif is_natural:
        estimated = estimate_expiry_date(normalized, is_natural=True)
        if estimated:
            row["expiry_date"] = estimated.isoformat()
            logger.info("Auto-estimated expiry untuk '%s' → %s", item_name, estimated.isoformat())

    return row


# Inventory Reconciliation (pengurangan stok setelah masak)

def reconcile_inventory(
    user_id: str,
    recipe_id: int,
    recipe_title: str,
    ingredients_used: list[dict[str, Any]],
) -> dict[str, Any]:
    # Kurangi stok bahan secara atomik setelah user konfirmasi selesai masak.

    # Args:
    #     user_id: ID pengguna.
    #     recipe_id: ID resep yang dimasak.
    #     recipe_title: Judul resep.
    #     ingredients_used: List of dict dengan keys:
    #         - item_id: UUID bahan di inventory_stock
    #         - quantity_used: Jumlah yang digunakan

    # Returns:
    #     Dict ringkasan hasil reconciliation.

    # Raises:
    #     ValueError: Jika stok tidak cukup atau item tidak ditemukan.
     
    sb = get_supabase()
    updated_items: list[dict] = []
    deleted_items: list[str] = []

    try:
        for usage in ingredients_used:
            item_id = usage["item_id"]
            qty_used = float(usage["quantity_used"])

            # Ambil stok saat ini
            current = (
                sb.table("inventory_stock")
                .select("id, item_name, quantity, unit")
                .eq("id", item_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not current.data:
                raise ValueError(f"Item {item_id} tidak ditemukan di inventaris user.")

            current_qty = float(current.data["quantity"])

            if qty_used > current_qty:
                raise ValueError(
                    f"Stok '{current.data['item_name']}' tidak cukup: "
                    f"tersisa {current_qty}, diminta {qty_used}"
                )

            new_qty = current_qty - qty_used

            if new_qty <= 0:
                # Hapus item jika stok habis
                sb.table("inventory_stock").delete().eq("id", item_id).eq("user_id", user_id).execute()
                deleted_items.append(current.data["item_name"])
            else:
                # Update kuantitas
                sb.table("inventory_stock").update({"quantity": new_qty}).eq("id", item_id).eq("user_id", user_id).execute()
                updated_items.append({
                    "item_name": current.data["item_name"],
                    "previous_qty": current_qty,
                    "new_qty": new_qty,
                    "unit": current.data["unit"],
                })

        # Catat ke consumption_history_log
        log_entry = {
            "user_id": user_id,
            "recipe_id": recipe_id,
            "recipe_title": recipe_title,
            "ingredients_snapshot": [
                {
                    "item_id": u["item_id"],
                    "quantity_used": u["quantity_used"],
                }
                for u in ingredients_used
            ],
            "cooked_at": datetime.utcnow().isoformat(),
        }

        try:
            sb.table("consumption_history_log").insert(log_entry).execute()
            logger.info("Riwayat konsumsi dicatat: resep '%s' oleh user %s", recipe_title, user_id)
        except Exception as log_err:
            # Log gagal tidak boleh menggagalkan reconciliation
            logger.warning("Gagal mencatat riwayat konsumsi: %s", log_err)

        return {
            "status": "success",
            "recipe_title": recipe_title,
            "items_updated": updated_items,
            "items_removed": deleted_items,
        }

    except ValueError:
        raise
    except Exception as e:
        logger.error("Reconciliation gagal: %s", e)
        raise ValueError(f"Reconciliation gagal: {str(e)}")


# Fetch inventory dengan SPI enrichment (untuk recommend endpoint)

def get_user_inventory_with_spi(user_id: str) -> list[dict[str, Any]]:
    # Ambil seluruh inventaris user, diperkaya dengan SPI score 
    sb = get_supabase()

    # Coba gunakan view jika tersedia, fallback ke tabel langsung
    try:
        result = (
            sb.table("inventory_with_spi")
            .select("*")
            .eq("user_id", user_id)
            .order("expiry_date", desc=False)
            .execute()
        )
        return [enrich_inventory_item(row) for row in result.data]
    except Exception:
        # Fallback: query langsung dari inventory_stock
        result = (
            sb.table("inventory_stock")
            .select("*")
            .eq("user_id", user_id)
            .order("expiry_date", desc=False)
            .execute()
        )
        return [enrich_inventory_item(row) for row in result.data]
