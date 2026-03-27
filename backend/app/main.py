# NirSisa Backend - Main Application
from __future__ import annotations

import logging
import os
import re
from contextlib import asynccontextmanager
from typing import List

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.metrics.pairwise import cosine_similarity
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from app.core.supabase import get_supabase

# Core & Config
from app.core.config import get_settings
from app.ai.cbf import RecipeKnowledgeBase  # Pastikan singleton ini benar

# Routers
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.recipes import router as recipes_router
from app.api.recommend import router as recommend_router

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# Inisialisasi Sastrawi (Global agar tidak re-init setiap request)
factory = StemmerFactory()
stemmer = factory.create_stemmer()

def preprocess_pipeline(text: str):
    """Pipeline pembersihan teks sesuai Metodologi Poin 6"""
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    return stemmer.stem(text)

def calculate_spi(days_remaining: int, alpha: float = 2.0):
    """Logika Spoilage Proximity Index (Novelty NirSisa)"""
    return 1 / ((days_remaining + 1) ** alpha)

# --- LIFESPAN (MANAGEMENT STARTUP/SHUTDOWN) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Mengelola siklus hidup aplikasi. 
    Memastikan Model AI dimuat hanya sekali saat startup.
    """
    logger.info("=== NirSisa Backend Starting ===")
    
    try:
        # Gunakan Singleton RecipeKnowledgeBase untuk memuat aset AI
        kb = RecipeKnowledgeBase.get_instance()
        kb.load()
        
        # Simpan reference ke app state agar bisa diakses oleh legacy endpoint
        app.state.ai_engine = kb
        
        logger.info(f"AI Engine Berhasil Dimuat: {len(kb.df_recipes)} resep tersedia.")
    except Exception as e:
        logger.error(f"KRITIS: Gagal memuat AI Engine: {e}")
        app.state.ai_engine = None

    yield
    logger.info("=== NirSisa Backend Shutting Down ===")

# --- SCHEMAS (LEGACY) ---

class IngredientItem(BaseModel):
    name: str
    days_left: int

class RecommendRequest(BaseModel):
    ingredients: List[IngredientItem]

# --- APP FACTORY ---

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

    # CORS Middleware
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

    # --- LEGACY ENDPOINTS (STAY IN MAIN FOR COMPATIBILITY) ---

    @app.get("/", tags=["Legacy"])
    def read_root():
        return {
            "status": "NirSisa Backend is Online",
            "version": settings.APP_VERSION,
            "engine": "TF-IDF + Cosine Similarity + SPI Re-ranking (Sastrawi Active)"
        }

    @app.post("/recommend", tags=["Legacy"])
    def recommend_legacy(request: RecommendRequest):
        """
        Endpoint legacy: Rekomendasi langsung dari request body (Stateless).
        Mengambil model dari app.state yang di-load saat lifespan.
        """
        engine = app.state.ai_engine
        
        if not engine or engine.vectorizer is None:
            raise HTTPException(status_code=503, detail="AI Engine is not ready")

        if not request.ingredients:
            raise HTTPException(status_code=400, detail="Inventory list cannot be empty")

        try:
            # 1. Preprocessing Input User
            raw_names = [item.name for item in request.ingredients]
            inventory_expiry = {item.name: item.days_left for item in request.ingredients}
            
            cleaned_query = preprocess_pipeline(" ".join(raw_names))

            # 2. Content-Based Filtering (Cosine Similarity)
            user_vec = engine.vectorizer.transform([cleaned_query])
            cos_sim = cosine_similarity(user_vec, engine.tfidf_matrix).flatten()

            # 3. SPI Re-ranking (Novelty)
            spi_scores = np.zeros(len(engine.df_recipes))
            
            for item in request.ingredients:
                clean_name = preprocess_pipeline(item.name)
                urgency = calculate_spi(item.days_left)
                
                # Cari bahan di dataframe yang sudah di-load di engine
                mask = engine.df_recipes['Ingredients Cleaned'].str.contains(
                    clean_name, case=False, na=False
                )
                spi_scores[mask] += urgency

            # 4. Final Hybrid Scoring (w1=0.6, w2=0.4 sesuai ERD/Dokumen)
            final_scores = (cos_sim * 0.6) + (spi_scores * 0.4)
            top_indices = final_scores.argsort()[-10:][::-1]

            # 5. Build Result
            recommendations = []
            for idx in top_indices:
                row = engine.df_recipes.iloc[idx]
                recommendations.append({
                    "title": row['Title'],
                    "score": round(float(final_scores[idx]), 4),
                    "similarity_score": round(float(cos_sim[idx]), 4),
                    "spi_score": round(float(spi_scores[idx]), 4),
                    "ingredients": row['Ingredients'],
                    "steps": row['Steps']
                })

            return {
                "query_cleaned": cleaned_query,
                "results_count": len(recommendations),
                "recommendations": recommendations
            }

        except Exception as e:
            logger.error(f"Legacy Recommend Error: {e}")
            raise HTTPException(status_code=500, detail="Internal AI Engine Error")

    return app

# Entry Point
app = create_app()

# Tambahkan ini di bagian import paling atas

# Tambahkan endpoint ini di dalam create_app()
@app.post("/auth/login", tags=["Auth"])
async def login_for_testing(email: str, password: str):
    sb = get_supabase()
    try:
        # Mencoba login langsung ke Supabase
        auth_response = sb.auth.sign_in_with_password({"email": email, "password": password})
        return {
            "access_token": auth_response.session.access_token,
            "token_type": "bearer",
            "user_id": auth_response.user.id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))