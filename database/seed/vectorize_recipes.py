"""
TF-IDF Vectorization Pipeline

Usage: python vectorize_recipes.py
"""

import os
import sys
import re
import io
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("Install dependencies: pip install supabase python-dotenv")
    sys.exit(1)

TFIDF_MAX_FEATURES = 5000
TFIDF_NGRAM_RANGE = (1, 2)
TFIDF_SUBLINEAR_TF = True
MODEL_VERSION = "v1.1"

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "artifacts"
OUTPUT_DIR.mkdir(exist_ok=True)


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in database/.env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


print("Initializing Sastrawi stemmer & stopword remover...")
_stemmer = StemmerFactory().create_stemmer()
_stopword_remover_factory = StopWordRemoverFactory()
_stopwords = set(_stopword_remover_factory.get_stop_words())

_extra_stopwords = {
    'secukupnya', 'sesuai', 'selera', 'sdm', 'sdt', 'sendok', 'makan',
    'teh', 'buah', 'butir', 'lembar', 'batang', 'siung', 'gram', 'kg',
    'ml', 'liter', 'potong', 'iris', 'cincang', 'halus', 'kasar',
    'besar', 'kecil', 'sedang', 'secukup', 'sedikit', 'banyak',
    'pack', 'bungkus', 'kaleng', 'cup', 'ons', 'papan',
}
_stopwords.update(_extra_stopwords)


def preprocess_ingredient(ingredient: str) -> str:
    ingredient = ingredient.lower().strip()
    ingredient = re.sub(r'[^a-z\s]', ' ', ingredient)
    ingredient = re.sub(r'\s+', ' ', ingredient).strip()

    if not ingredient:
        return ""

    words = ingredient.split()
    words = [w for w in words if w not in _stopwords and len(w) > 1]
    words = [_stemmer.stem(w) for w in words]
    words = [w for w in words if w]

    if not words:
        return ""

    return '_'.join(words)


def preprocess_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return ""

    raw_ingredients = text.split(',')

    processed = []
    seen = set()
    for ing in raw_ingredients:
        token = preprocess_ingredient(ing)
        if token and token not in seen:
            seen.add(token)
            processed.append(token)

    return ' '.join(processed)


def fetch_recipes(supabase: Client) -> pd.DataFrame:
    print("Fetching recipes from Supabase...")
    all_rows = []
    batch_size = 1000
    offset = 0

    while True:
        result = (
            supabase.table("recipes")
            .select("id, ingredients_cleaned")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        rows = result.data
        if not rows:
            break
        all_rows.extend(rows)
        offset += batch_size
        print(f"  Fetched {len(all_rows)} recipes...")

    df = pd.DataFrame(all_rows)
    print(f"  Total: {len(df)} recipes")
    return df


def build_tfidf(df: pd.DataFrame):
    print("\nPreprocessing ingredients text...")
    start = time.time()

    df["ingredients_processed"] = df["ingredients_cleaned"].apply(preprocess_text)

    elapsed = time.time() - start
    print(f"  Preprocessing done in {elapsed:.1f}s")

    print("\n  Sample preprocessing:")
    for i in range(min(3, len(df))):
        original = df["ingredients_cleaned"].iloc[i][:80]
        processed = df["ingredients_processed"].iloc[i][:80]
        print(f"    Original:  {original}...")
        print(f"    Processed: {processed}...")
        print()

    empty_count = (df["ingredients_processed"].str.strip() == "").sum()
    if empty_count > 0:
        print(f"  WARNING: {empty_count} recipes have empty ingredients after preprocessing")
        df.loc[df["ingredients_processed"].str.strip() == "", "ingredients_processed"] = "unknown"

    print("Fitting TF-IDF vectorizer...")
    print(f"  max_features={TFIDF_MAX_FEATURES}")
    print(f"  ngram_range={TFIDF_NGRAM_RANGE}")
    print(f"  sublinear_tf={TFIDF_SUBLINEAR_TF}")

    vectorizer = TfidfVectorizer(
        max_features=TFIDF_MAX_FEATURES,
        ngram_range=TFIDF_NGRAM_RANGE,
        sublinear_tf=TFIDF_SUBLINEAR_TF,
    )

    start = time.time()
    tfidf_matrix = vectorizer.fit_transform(df["ingredients_processed"])
    elapsed = time.time() - start

    print(f"  TF-IDF matrix shape: {tfidf_matrix.shape}")
    print(f"  Vocabulary size: {len(vectorizer.vocabulary_)}")
    print(f"  Fitting done in {elapsed:.1f}s")
    print(f"  Matrix density: {tfidf_matrix.nnz / (tfidf_matrix.shape[0] * tfidf_matrix.shape[1]) * 100:.2f}%")

    feature_names = vectorizer.get_feature_names_out()
    mean_tfidf = np.array(tfidf_matrix.mean(axis=0)).flatten()
    top_indices = mean_tfidf.argsort()[-20:][::-1]
    print("\n  Top 20 TF-IDF features (by mean score):")
    for idx in top_indices:
        print(f"    {feature_names[idx]}: {mean_tfidf[idx]:.4f}")

    recipe_ids = df["id"].tolist()
    return vectorizer, tfidf_matrix, recipe_ids


def save_local(vectorizer, tfidf_matrix, recipe_ids):
    print("\nSaving local artifacts...")

    vectorizer_path = OUTPUT_DIR / "tfidf_vectorizer.joblib"
    matrix_path = OUTPUT_DIR / "tfidf_matrix.joblib"
    ids_path = OUTPUT_DIR / "recipe_ids.json"

    joblib.dump(vectorizer, vectorizer_path)
    joblib.dump(tfidf_matrix, matrix_path)
    with open(ids_path, "w") as f:
        json.dump(recipe_ids, f)

    print(f"  Vectorizer: {vectorizer_path} ({vectorizer_path.stat().st_size / 1024:.0f} KB)")
    print(f"  Matrix:     {matrix_path} ({matrix_path.stat().st_size / 1024:.0f} KB)")
    print(f"  Recipe IDs: {ids_path}")


def save_to_supabase(supabase: Client, vectorizer, tfidf_matrix, recipe_ids):
    print("\nSaving to Supabase (recipe_tfidf_cache)...")

    vec_buffer = io.BytesIO()
    joblib.dump(vectorizer, vec_buffer)
    vec_bytes = vec_buffer.getvalue()

    mat_buffer = io.BytesIO()
    joblib.dump(tfidf_matrix, mat_buffer)
    mat_bytes = mat_buffer.getvalue()

    print(f"  Vectorizer blob: {len(vec_bytes) / 1024:.0f} KB")
    print(f"  Matrix blob: {len(mat_bytes) / 1024:.0f} KB")

    vec_hex = "\\x" + vec_bytes.hex()
    mat_hex = "\\x" + mat_bytes.hex()

    supabase.table("recipe_tfidf_cache").upsert(
        {
            "version": MODEL_VERSION,
            "vectorizer_blob": vec_hex,
            "tfidf_matrix_blob": mat_hex,
            "recipe_id_order": recipe_ids,
        },
        on_conflict="version",
    ).execute()

    print(f"  Saved as version '{MODEL_VERSION}'")


def main():
    print("=" * 60)
    print("NirSisa TF-IDF Vectorization Pipeline")
    print("=" * 60)
    print()

    supabase = get_supabase()
    df = fetch_recipes(supabase)
    vectorizer, tfidf_matrix, recipe_ids = build_tfidf(df)
    save_local(vectorizer, tfidf_matrix, recipe_ids)
    save_to_supabase(supabase, vectorizer, tfidf_matrix, recipe_ids)

    print("\nDone!")


if __name__ == "__main__":
    main()
