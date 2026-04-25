from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app.ai.cbf import RecipeKnowledgeBase
from app.ai.spi import calculate_spi

logger = logging.getLogger(__name__)

@dataclass
class InventoryItem:
    name: str
    days_remaining: int | None = None


@dataclass
class RecommendedRecipe:
    index: int
    title: str
    ingredients: str
    ingredients_cleaned: str
    steps: str
    loves: int
    url: str | None
    category: str | None
    total_ingredients: int
    total_steps: int
    quantity: str
    cosine_score: float
    spi_score: float
    final_score: float
    match_percentage: float


@dataclass
class RecommendationResult:
    recipes: list[RecommendedRecipe] = field(default_factory=list)
    latency_ms: float = 0.0
    spi_weight: float = 0.0  # Tambahkan ini


def diagnose_kb() -> dict:
    """Diagnostic: inspeksi knowledge base untuk debug cosine=0."""
    kb = RecipeKnowledgeBase.get_instance()
    if not kb.is_loaded:
        return {"status": "NOT_LOADED"}

    info: dict = {
        "status": "LOADED",
        "n_recipes": len(kb.df_recipes),
        "matrix_shape": list(kb.tfidf_matrix.shape),
        "columns": list(kb.df_recipes.columns),
    }

    vocab = kb.vectorizer.vocabulary_
    info["vocab_size"] = len(vocab)
    info["vocab_sample_30"] = sorted(vocab.keys())[:30]

    test_tokens = [
        "brokoli", "wortel", "tahu", "tempe", "ayam",
        "bawang_putih", "bawang_merah", "cabai_merah",
        "tahu_telur", "bakso_sapi", "telur",
    ]
    info["token_in_vocab"] = {t: (t in vocab) for t in test_tokens}

    if "Ingredients Cleaned" in kb.df_recipes.columns:
        sample = str(kb.df_recipes["Ingredients Cleaned"].iloc[0])[:200]
        info["sample_ingredients_cleaned"] = sample
        info["is_comma_separated"] = "," in sample
    else:
        info["sample_ingredients_cleaned"] = "COLUMN_NOT_FOUND"

    return info


def get_recommendations(
    inventory: list[InventoryItem],
    *,
    top_k: int = 10,
    spi_weight: float | None = None, # Ubah default jadi None
    alpha: float = 2.0,
    cosine_threshold: float = 0.0,
) -> RecommendationResult:
    t_start = time.perf_counter()

    kb = RecipeKnowledgeBase.get_instance()
    if not kb.is_loaded:
        raise RuntimeError("RecipeKnowledgeBase belum di-load.")

    n_recipes = len(kb.df_recipes)
    ingredient_names = [item.name.lower().strip() for item in inventory]
    user_text = ", ".join(ingredient_names)

    # Step 1: Compute Cosine
    cos_scores = kb.compute_cosine_scores(user_text)

    # Step 2: SPI Scores & Calculate Dynamic Weight
    spi_scores = np.zeros(n_recipes, dtype=float)
    max_inventory_urgency = 0.0 # Penampung tingkat krisis bahan

    expiry_map: dict[str, int] = {}
    for item in inventory:
        if item.days_remaining is not None:
            expiry_map[item.name.lower().strip()] = item.days_remaining

    for ingredient_name, days_rem in expiry_map.items():
        urgency = calculate_spi(days_rem, alpha=alpha)
        
        # Cari urgensi tertinggi dari semua bahan user
        if urgency > max_inventory_urgency:
            max_inventory_urgency = urgency
            
        mask = kb.recipe_contains_ingredient(ingredient_name)
        spi_scores[mask] += urgency

    # Normalisasi SPI Score (per resep)
    spi_max = spi_scores.max()
    spi_scores_norm = spi_scores / spi_max if spi_max > 0 else spi_scores

    # --- LOGIKA DINAMIS SPI WEIGHT ---
    # Jika tidak ditentukan manual, hitung otomatis berdasarkan bahan paling kritis
    if spi_weight is None:
        # Jika max_inventory_urgency tinggi (misal 0.9), maka kita beri bobot SPI lebih besar
        # Kita beri batas minimal 0.1 dan maksimal 0.8 agar tetap seimbang
        dynamic_weight = max(0.1, min(max_inventory_urgency, 0.8))
    else:
        dynamic_weight = spi_weight

    logger.info("Dynamic SPI Weight set to: %.2f (Max Urgency: %.2f)", dynamic_weight, max_inventory_urgency)

    # Step 3: Final Score menggunakan dynamic_weight
    cosine_weight = 1.0 - dynamic_weight
    final_scores = (cos_scores * cosine_weight) + (spi_scores_norm * dynamic_weight)

    # Step 4: Filter & Top-K (Tetap sama)
    candidate_indices = np.arange(n_recipes)
    sorted_candidates = candidate_indices[final_scores[candidate_indices].argsort()[::-1]]
    top_indices = sorted_candidates[:top_k]

    # Step 5: Build result (Tetap sama)
    df_top = kb.get_recipes_by_indices(top_indices)
    results: list[RecommendedRecipe] = []
    
    # ... (looping build RecommendedRecipe Anda tetap sama) ...
    # (Pastikan logic results.append Anda tetap menggunakan variabel idx dan row yang benar)

    for idx, (_, row) in zip(top_indices, df_top.iterrows()):
        recipe_text = str(row.get("Ingredients Cleaned", "")).lower()
        matched = sum(1 for ing in ingredient_names if ing in recipe_text)
        match_pct = (matched / len(ingredient_names) * 100) if ingredient_names else 0.0

        results.append(
            RecommendedRecipe(
                index=int(idx),
                title=str(row.get("Title", "")),
                ingredients=str(row.get("Ingredients", "")),
                ingredients_cleaned=str(row.get("Ingredients Cleaned", "")),
                steps=str(row.get("Steps", "")),
                loves=int(row.get("Loves", 0)),
                url=row.get("URL") if pd.notna(row.get("URL")) else None,
                category=row.get("Category") if pd.notna(row.get("Category")) else None,
                total_ingredients=int(row.get("Total Ingredients", 0)),
                total_steps=int(row.get("Total Steps", 0)),
                quantity=str(row.get("Quantity", "")),
                cosine_score=round(float(cos_scores[idx]), 6),
                spi_score=round(float(spi_scores_norm[idx]), 6),
                final_score=round(float(final_scores[idx]), 6),
                match_percentage=round(match_pct, 1),
            )
        )

    latency = (time.perf_counter() - t_start) * 1000
    
    # Masukkan dynamic_weight ke dalam hasil return
    return RecommendationResult(
        recipes=results, 
        latency_ms=round(latency, 2),
        spi_weight=round(dynamic_weight, 2)
    )