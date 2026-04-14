# Rekomendasi resep menggunakan TF-IDF Vectorizer + Cosine Similarity
# Matriks TF-IDF di-load sekali saat startup (lazy singleton) agar tidak menghitung ulang di setiap request

from __future__ import annotations

import os
import logging
from typing import Any

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import spmatrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def comma_tokenizer(text: str) -> list[str]:
    """Custom tokenizer matching vectorize_recipes.py — required to deserialize TF-IDF pkl."""
    tokens = []
    for part in text.split(","):
        token = part.strip()
        if token:
            token = "_".join(token.split())
            tokens.append(token)
    return tokens

logger = logging.getLogger(__name__)

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_APP_DIR = os.path.dirname(_CURRENT_DIR)
_DEFAULT_MODEL_PATH = os.path.join(_APP_DIR, "ml_models")
_DEFAULT_DATA_PATH = os.path.join(_APP_DIR, "data")


class RecipeKnowledgeBase:
    _instance: "RecipeKnowledgeBase | None" = None

    def __init__(self) -> None:
        self.vectorizer: TfidfVectorizer | None = None
        self.tfidf_matrix: spmatrix | None = None
        self.df_recipes: pd.DataFrame | None = None
        self._loaded = False

    @classmethod
    def get_instance(cls) -> "RecipeKnowledgeBase":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(
        self,
        model_path: str | None = None,
        data_path: str | None = None,
    ) -> None:
        # Load model dan data dari disk. 
        if self._loaded:
            return

        model_path = model_path or _DEFAULT_MODEL_PATH
        data_path = data_path or _DEFAULT_DATA_PATH

        vectorizer_file = os.path.join(model_path, "tfidf_vectorizer.pkl")
        matrix_file = os.path.join(model_path, "recipe_matrix.pkl")
        data_file = os.path.join(data_path, "recipe_data.pkl")

        logger.info("Loading TF-IDF vectorizer dari %s", vectorizer_file)
        self.vectorizer = joblib.load(vectorizer_file)

        logger.info("Loading TF-IDF matrix dari %s", matrix_file)
        self.tfidf_matrix = joblib.load(matrix_file)

        logger.info("Loading recipe dataframe dari %s", data_file)
        self.df_recipes = joblib.load(data_file)
        # Pastikan kolom kunci tidak NaN
        self.df_recipes["Ingredients Cleaned"] = (
            self.df_recipes["Ingredients Cleaned"].fillna("")
        )

        self._loaded = True
        logger.info(
            "Knowledge base ready – %d resep, matrix %s",
            len(self.df_recipes),
            self.tfidf_matrix.shape,
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------
    def compute_cosine_scores(self, user_text: str) -> np.ndarray:
        # Hitung cosine similarity antara query user dan seluruh resep

        # Args: user_text: Gabungan nama bahan, sudah di-lowercase & cleaned
        # Returns: Array 1-D berukuran (n_recipes,) berisi skor cosine [0..1]
        
        assert self._loaded, "Knowledge base belum di-load."
        user_vector = self.vectorizer.transform([user_text])
        scores = cosine_similarity(user_vector, self.tfidf_matrix).flatten()
        return scores

    def recipe_contains_ingredient(self, ingredient: str) -> np.ndarray:
        # Return boolean mask resep yang mengandung bahan tertentu 
        assert self._loaded, "Knowledge base belum di-load."
        return (
            self.df_recipes["Ingredients Cleaned"]
            .str.contains(ingredient, case=False, na=False)
            .values
        )

    def get_recipes_by_indices(self, indices: np.ndarray) -> pd.DataFrame:
        # Ambil baris resep berdasarkan array index 
        return self.df_recipes.iloc[indices].copy()
