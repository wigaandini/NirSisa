from fastapi import APIRouter
from app.core.supabase import get_supabase

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    try:
        sb = get_supabase()
        result = sb.table("recipe_categories").select("id").limit(1).execute()
        db_ok = len(result.data) > 0
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }
