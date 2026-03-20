from pydantic import BaseModel


class RecipeResponse(BaseModel):
    id: int
    title: str
    title_cleaned: str
    ingredients: str
    steps: str
    total_ingredients: int
    total_steps: int
    loves: int
    url: str | None
    category_name: str | None = None


class RecommendationResponse(BaseModel):
    recipe: RecipeResponse
    similarity_score: float
    spi_score: float
    final_score: float
