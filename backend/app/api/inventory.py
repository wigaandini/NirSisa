from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user_id
from app.core.supabase import get_supabase
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=list[InventoryItemResponse])
async def list_inventory(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("inventory_with_spi")
        .select("*")
        .eq("user_id", user_id)
        .order("expiry_date", desc=False)
        .execute()
    )
    return result.data


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_item(
    item: InventoryItemCreate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()

    row = {
        "user_id": user_id,
        "item_name": item.item_name,
        "quantity": item.quantity,
        "unit": item.unit,
        "is_natural": item.is_natural,
    }

    if item.expiry_date:
        row["expiry_date"] = item.expiry_date.isoformat()
    elif item.is_natural:
        # TODO: estimate expiry from shelf_life_reference
        pass

    result = sb.table("inventory_stock").insert(row).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to insert item")

    return result.data[0]


@router.patch("/{item_id}", response_model=dict)
async def update_item(
    item_id: str,
    item: InventoryItemUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()

    updates = item.model_dump(exclude_none=True)
    if "expiry_date" in updates and updates["expiry_date"]:
        updates["expiry_date"] = updates["expiry_date"].isoformat()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        sb.table("inventory_stock")
        .update(updates)
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")

    return result.data[0]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    result = (
        sb.table("inventory_stock")
        .delete()
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
