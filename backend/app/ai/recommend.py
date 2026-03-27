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
    
    # 1. Ambil data inventaris dari View 'inventory_with_spi'
    # Sesuai instruksi: "get from inventory_with_spi view"
    try:
        response = (
            sb.table("inventory_with_spi")
            .select("item_name_normalized, days_remaining")
            .eq("user_id", user_id)
            .gt("quantity", 0) # Pastikan bahan masih ada
            .execute()
        )
        db_inventory = response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data inventaris: {e}")

    if not db_inventory:
        return {
            "total_results": 0,
            "message": "Kulkas digital Anda kosong. Tambahkan bahan makanan terlebih dahulu.",
            "recommendations": []
        }

    # 2. Map data dari DB ke format Dataclass 'InventoryItem' di recommender.py
    inventory_items = [
        InventoryItem(
            name=item["item_name_normalized"], 
            days_remaining=item["days_remaining"]
        ) 
        for item in db_inventory
    ]

    # 3. Jalankan Pipeline AI Orchestrator
    try:
        # Gunakan weight 0.4 untuk SPI sesuai formula di dokumen Anda
        result = get_recommendations(
            inventory=inventory_items,
            top_k=top_k,
            spi_weight=0.4, 
            alpha=2.0
        )
        
        # 4. Return hasil dalam format JSON
        return {
            "total_results": len(result.recipes),
            "latency_ms": result.latency_ms,
            "recommendations": result.recipes
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {e}")