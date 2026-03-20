from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user_id
from app.core.supabase import get_supabase
from app.schemas.recipe import RecipeResponse

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("", response_model=list[RecipeResponse])
async def list_recipes(
    category: str | None = None,
    search: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    query = (
        sb.table("recipes")
        .select("*, recipe_categories(name)")
        .range(offset, offset + limit - 1)
        .order("loves", desc=True)
    )

    if category:
        query = query.eq("recipe_categories.name", category)

    if search:
        query = query.ilike("title_cleaned", f"%{search.lower()}%")

    result = query.execute()

    recipes = []
    for row in result.data:
        cat = row.pop("recipe_categories", None)
        row["category_name"] = cat["name"] if cat else None
        recipes.append(row)

    return recipes


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: int,
    _: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    result = (
        sb.table("recipes")
        .select("*, recipe_categories(name)")
        .eq("id", recipe_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Recipe not found")

    row = result.data
    cat = row.pop("recipe_categories", None)
    row["category_name"] = cat["name"] if cat else None
    return row
