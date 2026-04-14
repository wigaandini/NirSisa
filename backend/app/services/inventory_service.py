# Inventory Management Service
# Logika untuk pengelolaan inventaris bahan makanan:
# - CRUD operasi dengan normalisasi otomatis
# - Estimasi kedaluwarsa untuk bahan alami
# - Inventory Reconciliation (pengurangan stok setelah masak)
# - Pencatatan riwayat konsumsi

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Optional

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
    mapping = {
        "sayuran": 1,
        "buah-Buahan": 2,
        "daging Sapi": 3,
        "daging Ayam": 4,
        "daging Kambing": 5,
        "ikan": 6,
        "udang": 7,
        "telur": 8,
        "tahu": 9,
        "tempe": 10,
        "susu & Olahan": 11,
        "bumbu Segar": 12,
        "bumbu Kering": 13,
        "produk Jadi": 14,
        "minyak & Lemak": 15,
        "tepung": 16,
        "kacang-kacangan": 17,
        "roti & Bakery": 18,
    }
    if not name:
        return None
    return mapping.get(name.lower())


def prepare_insert_row(
    user_id: str,
    item_name: str,
    quantity: float,
    unit: str,
    is_natural: bool,
    expiry_date: date | None,
    category_name: Optional[str] = None,
) -> dict[str, Any]:
    normalized = normalize_ingredient_name(item_name)
    if not normalized:
        normalized = item_name.strip().lower()

    category_id = None
    if category_name:
        category_id = get_category_id_from_name(category_name)

    if not category_id:
        category_id = resolve_category_from_shelf_life(normalized)

    row: dict[str, Any] = {
        "user_id": user_id,
        "item_name": normalized,
        "item_name_normalized": normalized,
        "quantity": quantity,
        "unit": unit,
        "is_natural": is_natural,
    }

    if category_id:
        row["category_id"] = category_id

    if expiry_date:
        row["expiry_date"] = expiry_date.isoformat()
    elif is_natural:
        estimated = estimate_expiry_date(normalized, is_natural=True)
        if estimated:
            row["expiry_date"] = estimated.isoformat()
            logger.info(
                "Auto-estimated expiry untuk '%s' → %s",
                normalized, estimated.isoformat()
            )

    logger.info("prepare_insert_row: raw='%s' → normalized='%s'", item_name, normalized)
    return row


# ============================================================================
# Inventory Reconciliation (pengurangan stok setelah masak)
# ============================================================================

def _aggregate_ingredients_used(
    ingredients_used: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Gabungkan item_id yang sama agar tidak diproses dua kali.
    Ini penting jika satu bahan muncul di beberapa baris recipe dan frontend
    mengirim item_id yang sama lebih dari sekali.
    """
    merged: dict[str, float] = {}

    for usage in ingredients_used:
        item_id = usage["item_id"]
        qty_used = float(usage["quantity_used"])

        if qty_used <= 0:
            raise ValueError("quantity_used harus lebih besar dari 0")

        merged[item_id] = merged.get(item_id, 0.0) + qty_used

    return [
        {"item_id": item_id, "quantity_used": qty}
        for item_id, qty in merged.items()
    ]


def reconcile_inventory(
    user_id: str,
    recipe_id: int | None,
    recipe_title: str,
    ingredients_used: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Kurangi stok bahan setelah user konfirmasi selesai masak,
    dan catat ke consumption_history (parent) + consumption_history_items (children).
    """
    sb = get_supabase()
    updated_items: list[dict] = []
    deleted_items: list[str] = []
    items_snapshot: list[dict] = []

    try:
        normalized_usages = _aggregate_ingredients_used(ingredients_used)

        for usage in normalized_usages:
            item_id = usage["item_id"]
            qty_used = float(usage["quantity_used"])

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

            items_snapshot.append({
                "inventory_stock_id": item_id,
                "item_name": current.data["item_name"],
                "quantity_used": qty_used,
                "unit": current.data.get("unit"),
            })

            if new_qty <= 0:
                sb.table("inventory_stock").delete().eq("id", item_id).eq("user_id", user_id).execute()
                deleted_items.append(current.data["item_name"])
            else:
                sb.table("inventory_stock").update({"quantity": new_qty}).eq("id", item_id).eq("user_id", user_id).execute()
                updated_items.append({
                    "item_name": current.data["item_name"],
                    "previous_qty": current_qty,
                    "new_qty": new_qty,
                    "unit": current.data["unit"],
                })

        try:
            parent_row: dict[str, Any] = {
                "user_id": user_id,
                "recipe_title": recipe_title,
                "cooked_at": datetime.utcnow().isoformat(),
            }

            if recipe_id is not None:
                parent_row["recipe_id"] = recipe_id

            parent_result = sb.table("consumption_history").insert(parent_row).execute()

            if parent_result.data:
                consumption_id = parent_result.data[0]["id"]

                children_rows = [
                    {**snap, "consumption_id": consumption_id}
                    for snap in items_snapshot
                ]
                if children_rows:
                    sb.table("consumption_history_items").insert(children_rows).execute()

                logger.info(
                    "Riwayat dicatat: '%s' (%d items) oleh user %s",
                    recipe_title, len(items_snapshot), user_id
                )
        except Exception as log_err:
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
    sb = get_supabase()

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
        result = (
            sb.table("inventory_stock")
            .select("*")
            .eq("user_id", user_id)
            .order("expiry_date", desc=False)
            .execute()
        )
        return [enrich_inventory_item(row) for row in result.data]