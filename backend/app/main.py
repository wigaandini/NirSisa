# NirSisa Backend - Main Application
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from app.core.config import get_settings
from app.ai.cbf import RecipeKnowledgeBase
from app.ai.recommender import get_recommendations, InventoryItem

# Routers
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.recipes import router as recipes_router
from app.api.recommend import router as recommend_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# --- LIFESPAN (Startup & Shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== NirSisa Backend Starting ===")
    
    # LOAD MODEL HANYA SEKALI DI SINI
    try:
        kb = RecipeKnowledgeBase.get_instance()
        kb.load()
        logger.info(f"AI Engine siap: {len(kb.df_recipes)} resep dimuat.")
    except Exception as e:
        logger.error(f"GAGAL memuat AI Engine: {e}")

    yield
    logger.info("=== NirSisa Backend Shutting Down ===")

# --- LEGACY SCHEMAS (Untuk POST /recommend) ---
class IngredientItemLegacy(BaseModel):
    name: str
    days_left: int

class RecommendRequestLegacy(BaseModel):
    ingredients: List[IngredientItemLegacy]

# --- APP FACTORY ---
def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="NirSisa API",
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Modern Routers
    app.include_router(health_router)
    app.include_router(inventory_router)
    app.include_router(recipes_router)
    app.include_router(recommend_router)

    # --- LEGACY ENDPOINT (Disesuaikan ke Modul AI Baru) ---
    @app.get("/", tags=["Legacy"])
    def read_root():
        return {
            "status": "NirSisa Backend is Online",
            "engine": "Modular AI Engine Active"
        }

    @app.post("/recommend", tags=["Legacy"])
    def recommend_legacy(request: RecommendRequestLegacy):
        """
        Endpoint legacy tetap jalan, tapi sekarang memanggil 
        logic dari app.ai.recommender agar efisien.
        """
        try:
            # Map request manual ke format modul AI
            inventory = [
                InventoryItem(name=item.name, days_remaining=item.days_left)
                for item in request.ingredients
            ]
            
            result = get_recommendations(inventory=inventory, top_k=10)
            return {"recommendations": result.recipes}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return app

app = create_app()