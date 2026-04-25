from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.auth import get_current_user_id
from app.core.supabase import get_supabase
from app.ai.recommender import get_recommendations, InventoryItem
from app.core.config import get_settings

router = APIRouter(prefix="/recommend", tags=["Recommendations"])
settings = get_settings()

@router.get("")
async def recommend_recipes(
    user_id: str = Depends(get_current_user_id),
    top_k: int = Query(10, ge=1, le=50)
):
    """
    Mengambil data inventaris dari database user, 
    lalu menghasilkan rekomendasi resep berbasis AI (TF-IDF + SPI).
    """
    sb = get_supabase()
    
    try:
        response = (
            sb.table("inventory_with_spi")
            .select("item_name, item_name_normalized, days_remaining")
            .eq("user_id", user_id)
            .gt("quantity", 0)
            .execute()
        )
        db_inventory = response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data inventaris: {e}")

    if not db_inventory:
        return {
            "total_results": 0,
            "message": "Inventaris kosong.",
            "recommendations": []
        }

    # 1. Map data (Gunakan normalized jika ada, jika tidak gunakan name asli)
    inventory_items = [
        InventoryItem(
            name=item.get("item_name_normalized") or item.get("item_name"), 
            days_remaining=item["days_remaining"]
        ) 
        for item in db_inventory
    ]

    # 2. Jalankan Pipeline AI (TANPA memaksa spi_weight=0.4)
    try:
        # Hapus baris spi_weight=0.4 agar menggunakan logika dinamis di recommender.py
        result = get_recommendations(
            inventory=inventory_items,
            top_k=top_k,
            alpha=2.0
        )
        
        # 3. Return hasil lengkap dengan nilai spi_weight yang dihitung AI
        return {
            "total_results": len(result.recipes),
            "latency_ms": result.latency_ms,
            "spi_weight": getattr(result, 'spi_weight', 0.4), # Tampilkan berat yang dipakai
            "recommendations": result.recipes
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {e}")