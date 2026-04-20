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


def get_recommendations(
    inventory: list[InventoryItem],
    *,
    top_k: int = 10,
    spi_weight: float = 0.4,
    alpha: float = 2.0,
    cosine_threshold: float = 0.0,
) -> RecommendationResult:
    t_start = time.perf_counter()

    kb = RecipeKnowledgeBase.get_instance()
    if not kb.is_loaded:
        raise RuntimeError("RecipeKnowledgeBase belum di-load. Panggil kb.load() saat startup.")

    n_recipes = len(kb.df_recipes)
    ingredient_names = [item.name.lower().strip() for item in inventory]

    # Step 1: Cosine Similarity
    # PENTING: gabung dengan koma agar sesuai dengan comma_tokenizer di cbf.py
    user_text = ", ".join(ingredient_names)
    cos_scores = kb.compute_cosine_scores(user_text)

    # Step 2: SPI Scores
    spi_scores = np.zeros(n_recipes, dtype=float)

    expiry_map: dict[str, int] = {}
    for item in inventory:
        if item.days_remaining is not None:
            expiry_map[item.name.lower().strip()] = item.days_remaining

    for ingredient_name, days_rem in expiry_map.items():
        urgency = calculate_spi(days_rem, alpha=alpha)
        mask = kb.recipe_contains_ingredient(ingredient_name)
        spi_scores[mask] += urgency

    spi_max = spi_scores.max()
    if spi_max > 0:
        spi_scores_norm = spi_scores / spi_max
    else:
        spi_scores_norm = spi_scores

    # Step 3: Final Score
    cosine_weight = 1.0 - spi_weight
    final_scores = (cos_scores * cosine_weight) + (spi_scores_norm * spi_weight)

    # Step 4: Filter & Top-K
    if cosine_threshold > 0:
        valid_mask = cos_scores >= cosine_threshold
        candidate_indices = np.where(valid_mask)[0]
        if len(candidate_indices) == 0:
            candidate_indices = np.arange(n_recipes)
    else:
        candidate_indices = np.arange(n_recipes)

    sorted_candidates = candidate_indices[
        final_scores[candidate_indices].argsort()[::-1]
    ]
    top_indices = sorted_candidates[:top_k]

    # Step 5: Build result
    df_top = kb.get_recipes_by_indices(top_indices)

    results: list[RecommendedRecipe] = []
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

    logger.info(
        "Rekomendasi selesai: %d bahan → %d resep dalam %.1f ms",
        len(inventory),
        len(results),
        latency,
    )

    return RecommendationResult(recipes=results, latency_ms=round(latency, 2))
