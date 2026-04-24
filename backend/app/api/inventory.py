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
from app.services.normalizer import normalize_ingredient_name, suggest_unit, search_ingredients

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/ingredient-search")
async def ingredient_search(q: str, limit: int = 10):
    return search_ingredients(q, limit=limit)


@router.get("/unit-suggest")
async def get_unit_suggestion(item_name: str, category_id: int | None = None):
    result = suggest_unit(item_name, category_id=category_id)
    return {
        "item_name": item_name,
        "matched_name": result["matched_name"],
        "default_unit": result["default_unit"],
        "shelf_life_days": result["shelf_life_days"],
        "category_id": result["category_id"],
    }

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
    Tambah bahan ke inventaris. 
    Mendukung input category_name dari HP untuk dikonversi ke category_id di backend.
    """
    sb = get_supabase()

    # PERBAIKAN: Tambahkan parameter category_name agar dikonversi ke ID di service
    row = prepare_insert_row(
        user_id=user_id,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        is_natural=item.is_natural,
        expiry_date=item.expiry_date,
        category_name=item.category_name # <--- TERUSKAN DATA DARI FRONTEND
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
    sb = get_supabase()
    
    # 1. Ubah model ke dictionary, exclude_none=True agar field yang tidak diisi tidak ikut terupdate
    updates = item.model_dump(exclude_none=True, mode='json')

    # 2. Proses normalisasi nama jika ada perubahan nama
    if "item_name" in updates:
        updates["item_name_normalized"] = normalize_ingredient_name(updates["item_name"])

    # 3. FIX: Tangani category_name agar tidak menyebabkan error PGRST204
    if "category_name" in updates:
        cat_name = updates.pop("category_name") # Hapus category_name dari dictionary updates
        
        # Cari category_id berdasarkan namanya di tabel categories
        cat_res = sb.table("ingredient_categories").select("id").ilike("name", cat_name).execute()
        
        if cat_res.data:
            updates["category_id"] = cat_res.data[0]["id"]
        else:
            # Jika tidak ketemu, kita bisa set null atau biarkan kolom category_id yang lama
            # updates["category_id"] = None 
            pass

    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diubah.")

    # 4. Eksekusi ke Supabase
    try:
        result = (
            sb.table("inventory_stock")
            .update(updates)
            .eq("id", item_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Item tidak ditemukan atau akses ditolak.")

        # Gunakan fungsi helper Anda untuk mengembalikan data lengkap
        return enrich_inventory_item(result.data[0])
        
    except Exception as e:
        print(f"Error Database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gagal update ke database: {str(e)}")


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