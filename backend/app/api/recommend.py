from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user_id
from app.core.config import get_settings
from app.schemas.recipe import RecommendationResponse

router = APIRouter(prefix="/recommend", tags=["Recommendations"])


@router.get("", response_model=list[RecommendationResponse])
async def get_recommendations(
    user_id: str = Depends(get_current_user_id),
):
    # TODO: wire up app.ai.recommender
    raise HTTPException(
        status_code=501,
        detail="Not yet implemented",
    )
