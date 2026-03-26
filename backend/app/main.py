from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import pandas as pd
import numpy as np
import joblib
import os
import re
from sklearn.metrics.pairwise import cosine_similarity
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

app = FastAPI(title="NirSisa API - AI Powered Food Waste Mitigation")

# Inisialisasi Sastrawi Stemmer
factory = StemmerFactory()
stemmer = factory.create_stemmer()

# Path setup untuk model dan data
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, "ml_models")
DATA_PATH = os.path.join(CURRENT_DIR, "data")

# Load assets (model dan data)
try:
    vectorizer = joblib.load(os.path.join(MODEL_PATH, "tfidf_vectorizer.pkl"))
    tfidf_matrix = joblib.load(os.path.join(MODEL_PATH, "recipe_matrix.pkl"))
    df_recipes = joblib.load(os.path.join(DATA_PATH, "recipe_data.pkl"))
    print("AI Assets Loaded Successfully")
except Exception as e:
    print(f"Critical Error loading models: {e}")

# Schema (harus disesuaikan dengan input yang diharapkan dari frontend)
class IngredientItem(BaseModel):
    name: str
    days_left: int

class RecommendRequest(BaseModel):
    ingredients: List[IngredientItem]

# Preprocessing pipeline
def preprocess_pipeline(text: str):
    # Lowercasing
    text = text.lower()
    
    # Tokenisasi & Pembersihan Karakter (Punctuation Removal)
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    
    # 3. Stemming Sastrawi
    stemmed_text = stemmer.stem(text)
    
    return stemmed_text

# AI Logic
def calculate_spi(days_remaining, alpha=2.0):
    """Menghitung Spoilage Proximity Index sesuai rumus dokumen"""
    return 1 / ((days_remaining + 1) ** alpha)

# Routes
@app.get("/")
def read_root():
    return {
        "status": "NirSisa Backend is Online",
        "version": "1.0.0",
        "pipeline": "TF-IDF + Cosine Similarity + SPI Re-ranking (Sastrawi Active)"
    }

@app.post("/recommend")
def recommend(request: RecommendRequest):
    try:
        if not request.ingredients:
            raise HTTPException(status_code=400, detail="Inventory is empty")

        # Ambil data mentah dari request
        raw_user_ingredients = [item.name for item in request.ingredients]
        inventory_expiry = {item.name: item.days_left for item in request.ingredients}
        
        # Gabungkan semua nama bahan menjadi satu string lalu bersihkan
        user_input_string = ' '.join(raw_user_ingredients)
        cleaned_user_input = preprocess_pipeline(user_input_string)
        
        # 3. Content based filtering (Cosine Similarity)
        # Transformasi input yang sudah bersih menjadi vektor TF-IDF
        user_vector = vectorizer.transform([cleaned_user_input])
        cos_sim = cosine_similarity(user_vector, tfidf_matrix).flatten()
        
        # 4. SPI Re-ranking
        spi_scores = np.zeros(len(df_recipes))
        for item in request.ingredients:
            # Preprocess nama bahan secara individu untuk pencarian akurat
            clean_ing_name = preprocess_pipeline(item.name)
            urgency_score = calculate_spi(item.days_left)
            
            # Cari resep yang mengandung bahan kritis tersebut
            # Menggunakan 'Ingredients Cleaned' yang sudah di-preprocess saat EDA
            mask = df_recipes['Ingredients Cleaned'].str.contains(clean_ing_name, case=False, na=False)
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

    except Exception as e:
        print(f"Internal Server Error: {e}")
        raise HTTPException(status_code=500, detail="Check server logs for details")