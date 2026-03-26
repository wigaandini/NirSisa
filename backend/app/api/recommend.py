# Ambil bahan user dari DB -> jalankan AI Engine -> return Top-K resep.

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user_id
from app.core.config import get_settings
from app.schemas.recipe import RecommendationResponse, RecommendationItem
from app.services.inventory_service import get_user_inventory_with_spi
from app.ai.recommender import (
    get_recommendations,
    InventoryItem as AIInventoryItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommend", tags=["Recommendations"])


def _build_explanation(item: dict) -> str:
    # Bangun teks penjelasan Explainable AI untuk satu rekomendasi 
    parts: list[str] = []

    match_pct = item.get("match_percentage", 0)
    if match_pct >= 80:
        parts.append(f"Resep ini cocok {match_pct:.0f}% dengan bahan Anda")
    elif match_pct >= 50:
        parts.append(f"Resep ini menggunakan {match_pct:.0f}% bahan yang Anda miliki")

    spi = item.get("spi_score", 0)
    if spi > 0.5:
        parts.append("mengandung bahan yang segera kedaluwarsa")
    elif spi > 0.2:
        parts.append("membantu menghabiskan bahan yang mendekati kedaluwarsa")

    if not parts:
        parts.append("Resep relevan berdasarkan bahan yang tersedia")

    return "; ".join(parts) + "."


@router.get("", response_model=RecommendationResponse)
async def recommend(
    user_id: str = Depends(get_current_user_id),
    top_k: int = Query(default=None, ge=1, le=50, description="Jumlah rekomendasi"),
):
    # Dapatkan rekomendasi resep berdasarkan inventaris user

    # Pipeline:
    # 1. Ambil seluruh stok bahan user dari database
    # 2. Hitung SPI per-bahan
    # 3. Jalankan Content-Based Filtering + SPI re-ranking
    # 4. Return Top-K resep dengan skor & penjelasan
    
    settings = get_settings()
    k = top_k or settings.TOP_K_RECOMMENDATIONS

    # Step 1: Ambil inventaris user
    inventory = get_user_inventory_with_spi(user_id)

    if not inventory:
        raise HTTPException(
            status_code=400,
            detail="Inventaris kosong. Tambahkan bahan terlebih dahulu.",
        )

    # Step 2: Konversi ke format AI engine
    ai_items: list[AIInventoryItem] = []
    for item in inventory:
        name = item.get("item_name_normalized") or item.get("item_name", "")
        days = item.get("days_remaining")
        ai_items.append(AIInventoryItem(name=name, days_remaining=days))

    # Step 3: Jalankan rekomendasi
    try:
        result = get_recommendations(
            inventory=ai_items,
            top_k=k,
            spi_weight=settings.SPI_WEIGHT,
            alpha=settings.SPI_DECAY_FACTOR,
            cosine_threshold=0.0,  
        )
    except RuntimeError as e:
        logger.error("AI engine error: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Mesin rekomendasi belum siap. Coba lagi nanti.",
        )

    # Step 4: Build response
    recommendations: list[RecommendationItem] = []
    for rec in result.recipes:
        item_dict = {
            "index": rec.index,
            "title": rec.title,
            "ingredients": rec.ingredients,
            "ingredients_cleaned": rec.ingredients_cleaned,
            "steps": rec.steps,
            "loves": rec.loves,
            "url": rec.url,
            "category": rec.category,
            "total_ingredients": rec.total_ingredients,
            "total_steps": rec.total_steps,
            "cosine_score": rec.cosine_score,
            "spi_score": rec.spi_score,
            "final_score": rec.final_score,
            "match_percentage": rec.match_percentage,
        }
        item_dict["explanation"] = _build_explanation(item_dict)
        recommendations.append(RecommendationItem(**item_dict))

    return RecommendationResponse(
        total_results=len(recommendations),
        latency_ms=result.latency_ms,
        spi_weight=settings.SPI_WEIGHT,
        recommendations=recommendations,
    )
