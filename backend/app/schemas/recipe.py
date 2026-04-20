from __future__ import annotations

from pydantic import BaseModel, Field


class RecipeResponse(BaseModel):
    id: int
    title: str
    title_cleaned: str | None = None
    ingredients: str
    steps: str
    total_ingredients: int = 0
    total_steps: int = 0
    loves: int = 0
    url: str | None = None
    category_name: str | None = None
    quantity: str | None = None


class RecommendationItem(BaseModel):
    index: int = Field(description="Index resep di knowledge base")
    title: str
    ingredients: str
    ingredients_cleaned: str
    steps: str
    loves: int = 0
    url: str | None = None
    category: str | None = None
    total_ingredients: int = 0
    total_steps: int = 0
    quantity: str | None = None
    cosine_score: float = Field(description="Skor kecocokan TF-IDF Cosine Similarity")
    spi_score: float = Field(description="Skor urgensi Spoilage Proximity Index (normalized)")
    final_score: float = Field(description="Skor akhir = (1-λ)*cosine + λ*SPI")
    match_percentage: float = Field(description="Persentase bahan user yang cocok di resep")
    explanation: str | None = Field(
        default=None,
        description="Penjelasan mengapa resep ini direkomendasikan (Explainable AI)",
    )


class RecommendationResponse(BaseModel):
    total_results: int
    latency_ms: float
    spi_weight: float
    recommendations: list[RecommendationItem]


class RecommendationResponseLegacy(BaseModel):
    recipe: RecipeResponse
    similarity_score: float
    spi_score: float
    final_score: float
