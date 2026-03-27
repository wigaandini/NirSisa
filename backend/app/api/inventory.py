# CRUD inventaris bahan makanan + Inventory Reconciliation
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.core.auth import get_current_user_id
from app.core.supabase import get_supabase
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    ReconciliationRequest,
    ReconciliationResponse,
)
from app.services.inventory_service import (
    enrich_inventory_item,
    prepare_insert_row,
    reconcile_inventory,
)
from app.services.normalizer import normalize_ingredient_name

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# GET  /inventory  — Daftar seluruh stok user
@router.get("", response_model=list[InventoryItemResponse])
async def list_inventory(user_id: str = Depends(get_current_user_id)):
    """
    Ambil seluruh inventaris milik user berdasarkan Token JWT.
    Hasil diperkaya dengan perhitungan SPI score dan indikator kesegaran.
    """
    sb = get_supabase()

    try:
        # Mencoba ambil dari View (kalkulasi SPI di level DB)
        result = (
            sb.table("inventory_with_spi")
            .select("*")
            .eq("user_id", user_id)
            .order("expiry_date", desc=False)
            .execute()
        )
    except Exception:
        # Fallback ke tabel mentah jika View belum tersedia
        result = (
            sb.table("inventory_stock")
            .select("*")
            .eq("user_id", user_id)
            .order("expiry_date", desc=False)
            .execute()
        )

    return [enrich_inventory_item(row) for row in result.data]


# POST /inventory  — Tambah bahan baru
@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item(
    item: InventoryItemCreate,
    user_id: str = Depends(get_current_user_id),
):
    """
    Tambah bahan ke inventaris dengan verifikasi identitas user.
    Nama bahan dinormalisasi otomatis menggunakan Sastrawi.
    """
    sb = get_supabase()

    row = prepare_insert_row(
        user_id=user_id,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        is_natural=item.is_natural,
        expiry_date=item.expiry_date,
    )

    result = sb.table("inventory_stock").insert(row).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Gagal menyimpan bahan ke inventaris.")

    return enrich_inventory_item(result.data[0])


# PATCH /inventory/{item_id}  — Update bahan
@router.patch("/{item_id}", response_model=InventoryItemResponse)
async def update_item(
    item_id: str,
    item: InventoryItemUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Update detail bahan milik user."""
    sb = get_supabase()
    updates = item.model_dump(exclude_none=True)

    if "item_name" in updates:
        updates["item_name_normalized"] = normalize_ingredient_name(updates["item_name"])

    if "expiry_date" in updates and updates["expiry_date"]:
        updates["expiry_date"] = updates["expiry_date"].isoformat()

    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diperbarui.")

    result = (
        sb.table("inventory_stock")
        .update(updates)
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan atau bukan milik Anda.")

    return enrich_inventory_item(result.data[0])


# DELETE /inventory/{item_id}  — Hapus bahan
@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Hapus bahan dari inventaris."""
    sb = get_supabase()
    result = (
        sb.table("inventory_stock")
        .delete()
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan atau bukan milik Anda.")


# POST /inventory/reconcile  — Konfirmasi masak
@router.post("/reconcile", response_model=ReconciliationResponse)
async def reconcile(
    body: ReconciliationRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Proses pengurangan stok otomatis setelah memasak (Inventory Reconciliation)."""
    try:
        result = reconcile_inventory(
            user_id=user_id,
            recipe_id=body.recipe_id,
            recipe_title=body.recipe_title,
            ingredients_used=[
                {"item_id": u.item_id, "quantity_used": u.quantity_used}
                for u in body.ingredients_used
            ],
        )
        return ReconciliationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))