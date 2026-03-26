# NirSisa Backend - Main Application
# Entry point FastAPI. Menggabungkan:
# 1. Legacy endpoint (POST /recommend) dengan Sastrawi preprocessing
# 2. Router-based endpoints (inventory, recipes, recommend, health)

# Endpoint:
# Legacy (tanpa auth)
# - GET  /                -> Status server
# - POST /recommend       -> Rekomendasi resep (langsung dari request body, Sastrawi active)

# Router-based (dengan JWT auth)
# - GET  /health          -> Status server, DB, & AI engine
# - GET  /inventory       -> Daftar stok user
# - POST /inventory       -> Tambah bahan
# - PATCH /inventory/{id} -> Update bahan
# - DELETE /inventory/{id}-> Hapus bahan
# - POST /inventory/reconcile -> Konfirmasi masak
# - GET  /recipes         -> Browse resep
# - GET  /recipes/{id}    -> Detail resep
# - GET  /recommend       -> Rekomendasi resep (dari inventaris DB user)

from __future__ import annotations

import logging
import os
import re
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import numpy as np
import pandas as pd
import joblib
from sklearn.metrics.pairwise import cosine_similarity
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

from app.core.config import get_settings

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

# Inisialisasi Sastrawi Stemmer (dari versi teman)
factory = StemmerFactory()
stemmer = factory.create_stemmer()

# Path setup untuk model dan data
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, "ml_models")
DATA_PATH = os.path.join(CURRENT_DIR, "data")

# Legacy globals
vectorizer = None
tfidf_matrix = None
df_recipes = None


def _load_legacy_models():
    # Load model untuk legacy endpoint POST /recommend
    global vectorizer, tfidf_matrix, df_recipes
    try:
        vectorizer = joblib.load(os.path.join(MODEL_PATH, "tfidf_vectorizer.pkl"))
        tfidf_matrix = joblib.load(os.path.join(MODEL_PATH, "recipe_matrix.pkl"))
        df_recipes = pd.read_pickle(os.path.join(DATA_PATH, "recipe_data.pkl"))
        df_recipes["Ingredients Cleaned"] = df_recipes["Ingredients Cleaned"].fillna("")
        logger.info("AI Assets Loaded Successfully: %d resep", len(df_recipes))
    except Exception as e:
        logger.error("Critical Error loading models: %s", e)


# Legacy schemas
class IngredientItem(BaseModel):
    name: str
    days_left: int


class RecommendRequest(BaseModel):
    ingredients: List[IngredientItem]


# Preprocessing pipeline (dari versi teman, Sastrawi)
def preprocess_pipeline(text: str):
    # Lowercasing
    text = text.lower()
    # Tokenisasi & Pembersihan Karakter (Punctuation Removal)
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    # Stemming Sastrawi
    stemmed_text = stemmer.stem(text)
    return stemmed_text


# AI Logic
def calculate_spi(days_remaining, alpha=2.0):
    # Menghitung Spoilage Proximity Index
    return 1 / ((days_remaining + 1) ** alpha)


# Lifespan – load models saat startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== NirSisa Backend Starting ===")

    # Load legacy models (untuk POST /recommend)
    _load_legacy_models()

    # Load AI Knowledge Base baru (untuk GET /recommend via router)
    try:
        from app.ai.cbf import RecipeKnowledgeBase
        kb = RecipeKnowledgeBase.get_instance()
        kb.load()
        logger.info("AI Engine siap: %d resep dimuat.", len(kb.df_recipes))
    except Exception as e:
        logger.error("GAGAL memuat AI Engine: %s", e)
        logger.warning("Server tetap berjalan, tapi GET /recommend akan error.")

    yield
    logger.info("=== NirSisa Backend Shutting Down ===")


# App Factory
def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="NirSisa API - AI Powered Food Waste Mitigation",
        version=settings.APP_VERSION,
        description=(
            "Backend API untuk NirSisa – Sistem Rekomendasi Masakan Adaptif "
            "berbasis AI untuk memitigasi Food Waste rumah tangga."
        ),
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers (tanpa prefix tambahan, router sudah punya prefix sendiri)
    app.include_router(health_router)
    app.include_router(inventory_router)
    app.include_router(recipes_router)
    app.include_router(recommend_router)

    # LEGACY ENDPOINTS

    @app.get("/", tags=["Legacy"])
    def read_root():
        return {
            "status": "NirSisa Backend is Online",
            "version": "1.0.0",
            "pipeline": "TF-IDF + Cosine Similarity + SPI Re-ranking (Sastrawi Active)"
        }

    @app.post("/recommend", tags=["Legacy"])
    def recommend(request: RecommendRequest):
        # Endpoint legacy: rekomendasi langsung dari request body (tanpa auth)
        # Menggunakan Sastrawi preprocessing pipeline
        try:
            if vectorizer is None or tfidf_matrix is None or df_recipes is None:
                raise HTTPException(status_code=503, detail="Models not loaded")

            if not request.ingredients:
                raise HTTPException(status_code=400, detail="Inventory is empty")

            # Ambil data mentah dari request
            raw_user_ingredients = [item.name for item in request.ingredients]
            inventory_expiry = {item.name: item.days_left for item in request.ingredients}

            # Gabungkan semua nama bahan menjadi satu string lalu bersihkan
            user_input_string = ' '.join(raw_user_ingredients)
            cleaned_user_input = preprocess_pipeline(user_input_string)

            # Content based filtering (Cosine Similarity)
            user_vector = vectorizer.transform([cleaned_user_input])
            cos_sim = cosine_similarity(user_vector, tfidf_matrix).flatten()

            # SPI Re-ranking
            spi_scores = np.zeros(len(df_recipes))
            for item in request.ingredients:
                # Preprocess nama bahan secara individu untuk pencarian akurat
                clean_ing_name = preprocess_pipeline(item.name)
                urgency_score = calculate_spi(item.days_left)

                # Cari resep yang mengandung bahan kritis tersebut
                mask = df_recipes['Ingredients Cleaned'].str.contains(
                    clean_ing_name, case=False, na=False
                )
                spi_scores[mask] += urgency_score

            # Final Scoring
            final_scores = (cos_sim * 0.6) + (spi_scores * 0.4)

            # Sorting Top 10 Rekomendasi
            top_indices = final_scores.argsort()[-10:][::-1]

            results = []
            for idx in top_indices:
                results.append({
                    "title": df_recipes.iloc[idx]['Title'],
                    "score": round(float(final_scores[idx]), 4),
                    "similarity_component": round(float(cos_sim[idx]), 4),
                    "spi_component": round(float(spi_scores[idx]), 4),
                    "ingredients": df_recipes.iloc[idx]['Ingredients'],
                    "steps": df_recipes.iloc[idx]['Steps']
                })

            return {
                "query_cleaned": cleaned_user_input,
                "recommendations": results
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Internal Server Error: %s", e)
            raise HTTPException(status_code=500, detail="Check server logs for details")

    return app


app = create_app()