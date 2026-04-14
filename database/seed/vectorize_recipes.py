"""
TF-IDF Vectorization Pipeline v2
=================================
Reads cleaned CSV (v2), builds TF-IDF model, saves artifacts locally
and syncs to Supabase.

Data source: Indonesian_Food_Recipes_Cleaned_v2.csv (local)
Model version: v2.0

Usage: python vectorize_recipes.py
"""

import os
import sys
import io
import json
import time
import logging
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer


try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("Install dependencies: pip install supabase python-dotenv")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

MODEL_VERSION = "v2.0"
TFIDF_MAX_FEATURES = 5000
TFIDF_NGRAM_RANGE = (1, 2)
TFIDF_SUBLINEAR_TF = True

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────────────────

_SEED_DIR = Path(__file__).resolve().parent           # database/seed/
_DB_DIR = _SEED_DIR.parent                             # database/
_ROOT_DIR = _DB_DIR.parent                             # NirSisa/
_EDA_DIR = _ROOT_DIR / "EDA Dataset"

CSV_PATH = _EDA_DIR / "Indonesian_Food_Recipes_Cleaned_v2.csv"
ARTIFACT_DIR = _DB_DIR / "artifacts"
ML_MODEL_DIR = _ROOT_DIR / "backend" / "app" / "ml_models"
DATA_DIR = _ROOT_DIR / "backend" / "app" / "data"

ARTIFACT_DIR.mkdir(exist_ok=True)
ML_MODEL_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

# Add backend/ to sys.path so pickle stores 'app.ai.cbf.comma_tokenizer'
# This ensures Railway can deserialize the vectorizer correctly
sys.path.insert(0, str(_ROOT_DIR / "backend"))
from app.ai.cbf import comma_tokenizer

# ─── Supabase ────────────────────────────────────────────────────────────────

load_dotenv(_DB_DIR / ".env")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in database/.env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# comma_tokenizer imported from app.ai.cbf (above)
# This ensures pickle stores 'app.ai.cbf.comma_tokenizer' as the reference


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Load CSV
# ═══════════════════════════════════════════════════════════════════════════════

def load_csv() -> pd.DataFrame:
    log.info("STEP 1: Loading CSV from %s", CSV_PATH)

    if not CSV_PATH.exists():
        log.error("CSV not found: %s", CSV_PATH)
        log.error("Run clean_ingredients.py first to generate the cleaned CSV.")
        sys.exit(1)

    df = pd.read_csv(CSV_PATH, encoding="utf-8")
    log.info("  Loaded %d rows", len(df))

    # Validate
    if "Ingredients Cleaned" not in df.columns:
        log.error("Column 'Ingredients Cleaned' not found in CSV")
        sys.exit(1)

    # Ensure non-null strings
    df["Ingredients Cleaned"] = df["Ingredients Cleaned"].fillna("").astype(str)

    empty_count = (df["Ingredients Cleaned"].str.strip() == "").sum()
    if empty_count > 0:
        log.warning("  %d rows have empty Ingredients Cleaned", empty_count)

    log.info("  Columns: %s", list(df.columns))
    log.info("  Sample: %s", df["Ingredients Cleaned"].iloc[0][:80])

    return df


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Build TF-IDF
# ═══════════════════════════════════════════════════════════════════════════════

def build_tfidf(df: pd.DataFrame):
    log.info("STEP 2: Building TF-IDF model")
    log.info("  max_features=%d, ngram_range=%s, sublinear_tf=%s",
             TFIDF_MAX_FEATURES, TFIDF_NGRAM_RANGE, TFIDF_SUBLINEAR_TF)

    corpus = df["Ingredients Cleaned"].tolist()

    vectorizer = TfidfVectorizer(
        tokenizer=comma_tokenizer,
        lowercase=True,
        token_pattern=None,
        max_features=TFIDF_MAX_FEATURES,
        ngram_range=TFIDF_NGRAM_RANGE,
        sublinear_tf=TFIDF_SUBLINEAR_TF,
    )

    t0 = time.perf_counter()
    tfidf_matrix = vectorizer.fit_transform(corpus)
    elapsed = time.perf_counter() - t0

    log.info("  Matrix shape: %s", tfidf_matrix.shape)
    log.info("  Vocabulary size: %d", len(vectorizer.vocabulary_))
    log.info("  Density: %.2f%%", tfidf_matrix.nnz / (tfidf_matrix.shape[0] * tfidf_matrix.shape[1]) * 100)
    log.info("  Built in %.1fs", elapsed)

    # Top features
    feature_names = vectorizer.get_feature_names_out()
    mean_tfidf = np.array(tfidf_matrix.mean(axis=0)).flatten()
    top_idx = mean_tfidf.argsort()[-20:][::-1]
    log.info("  Top 20 TF-IDF features:")
    for idx in top_idx:
        log.info("    %s: %.4f", feature_names[idx], mean_tfidf[idx])

    return vectorizer, tfidf_matrix


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Save artifacts locally
# ═══════════════════════════════════════════════════════════════════════════════

def save_local(df: pd.DataFrame, vectorizer, tfidf_matrix):
    log.info("STEP 3: Saving local artifacts")

    # backend/app/ml_models/
    vec_path = ML_MODEL_DIR / "tfidf_vectorizer.pkl"
    mat_path = ML_MODEL_DIR / "recipe_matrix.pkl"
    joblib.dump(vectorizer, vec_path)
    joblib.dump(tfidf_matrix, mat_path)
    log.info("  %s (%d KB)", vec_path, vec_path.stat().st_size // 1024)
    log.info("  %s (%d KB)", mat_path, mat_path.stat().st_size // 1024)

    # backend/app/data/recipe_data.pkl
    data_path = DATA_DIR / "recipe_data.pkl"
    joblib.dump(df, data_path)  # use joblib instead of pd.to_pickle to avoid pyarrow
    log.info("  %s (%d KB)", data_path, data_path.stat().st_size // 1024)

    # database/artifacts/
    joblib.dump(vectorizer, ARTIFACT_DIR / "tfidf_vectorizer.joblib")
    joblib.dump(tfidf_matrix, ARTIFACT_DIR / "tfidf_matrix.joblib")
    with open(ARTIFACT_DIR / "recipe_ids.json", "w") as f:
        # Use index as ID since CSV doesn't have Supabase IDs
        json.dump(list(range(len(df))), f)
    log.info("  database/artifacts/ updated")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Sync to Supabase
# ═══════════════════════════════════════════════════════════════════════════════

def sync_tfidf_cache(supabase: Client, vectorizer, tfidf_matrix, df: pd.DataFrame):
    """Step 4A: Upload model to recipe_tfidf_cache"""
    log.info("STEP 4A: Uploading TF-IDF model to Supabase recipe_tfidf_cache")

    vec_buf = io.BytesIO()
    joblib.dump(vectorizer, vec_buf)
    vec_bytes = vec_buf.getvalue()

    mat_buf = io.BytesIO()
    joblib.dump(tfidf_matrix, mat_buf)
    mat_bytes = mat_buf.getvalue()

    log.info("  Vectorizer blob: %d KB", len(vec_bytes) // 1024)
    log.info("  Matrix blob: %d KB", len(mat_bytes) // 1024)

    vec_hex = "\\x" + vec_bytes.hex()
    mat_hex = "\\x" + mat_bytes.hex()

    recipe_ids = list(range(len(df)))

    supabase.table("recipe_tfidf_cache").upsert(
        {
            "version": MODEL_VERSION,
            "vectorizer_blob": vec_hex,
            "tfidf_matrix_blob": mat_hex,
            "recipe_id_order": recipe_ids,
        },
        on_conflict="version",
    ).execute()

    log.info("  Uploaded as version '%s'", MODEL_VERSION)


def sync_recipes_table(supabase: Client, df: pd.DataFrame):
    """Step 4B: Update ingredients_cleaned in recipes table"""
    log.info("STEP 4B: Updating recipes.ingredients_cleaned in Supabase")

    # First check how many recipes exist in Supabase
    count_result = supabase.table("recipes").select("id", count="exact").execute()
    db_count = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
    csv_count = len(df)

    log.info("  Supabase recipes: %d, CSV rows: %d", db_count, csv_count)

    if db_count != csv_count:
        log.warning("=" * 60)
        log.warning("MANUAL ACTION REQUIRED:")
        log.warning("  Row count mismatch: Supabase=%d, CSV=%d", db_count, csv_count)
        log.warning("  Cannot safely update ingredients_cleaned without matching rows.")
        log.warning("")
        log.warning("  Options:")
        log.warning("  1. Re-seed recipes from CSV v2 (truncate + re-insert)")
        log.warning("  2. Match by title (risky if titles changed)")
        log.warning("")
        log.warning("  To re-seed, run in Supabase SQL Editor:")
        log.warning("    TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;")
        log.warning("  Then run: python seed_recipes.py (with CSV v2 path)")
        log.warning("=" * 60)
        log.warning("  Skipping recipes table update for safety.")
        return False

    # Fetch all recipe IDs in order
    log.info("  Fetching recipe IDs from Supabase...")
    all_ids = []
    batch_size = 1000
    offset = 0
    while True:
        result = (
            supabase.table("recipes")
            .select("id")
            .order("id")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_ids.extend([r["id"] for r in result.data])
        offset += batch_size

    if len(all_ids) != csv_count:
        log.error("  ID fetch mismatch: got %d, expected %d", len(all_ids), csv_count)
        return False

    # Batch update
    log.info("  Updating %d rows in batches...", csv_count)
    batch_size = 500
    updated = 0
    for start in range(0, csv_count, batch_size):
        end = min(start + batch_size, csv_count)
        for idx in range(start, end):
            recipe_id = all_ids[idx]
            new_cleaned = df["Ingredients Cleaned"].iloc[idx]
            supabase.table("recipes").update(
                {"ingredients_cleaned": new_cleaned}
            ).eq("id", recipe_id).execute()
            updated += 1

        log.info("  Updated %d / %d rows", updated, csv_count)

    log.info("  recipes.ingredients_cleaned sync complete")
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Validation
# ═══════════════════════════════════════════════════════════════════════════════

def validate(df: pd.DataFrame, tfidf_matrix):
    log.info("STEP 6: Validation")

    csv_rows = len(df)
    matrix_rows = tfidf_matrix.shape[0]

    log.info("  CSV rows:    %d", csv_rows)
    log.info("  Matrix rows: %d", matrix_rows)

    if csv_rows != matrix_rows:
        log.error("  MISMATCH: CSV (%d) != Matrix (%d)", csv_rows, matrix_rows)
        return False

    # Check for empty vectors
    row_sums = np.array(tfidf_matrix.sum(axis=1)).flatten()
    empty_vectors = (row_sums == 0).sum()
    if empty_vectors > 0:
        log.warning("  %d recipes have empty TF-IDF vectors", empty_vectors)

    # Check vocabulary
    log.info("  Vocabulary non-empty: %s", tfidf_matrix.shape[1] > 0)
    log.info("  No NaN in matrix: %s", not np.isnan(tfidf_matrix.data).any())

    log.info("  Validation PASSED")
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print(f"NirSisa TF-IDF Vectorization Pipeline {MODEL_VERSION}")
    print("=" * 60)

    # Step 1
    df = load_csv()

    # Step 2
    vectorizer, tfidf_matrix = build_tfidf(df)

    # Step 3
    save_local(df, vectorizer, tfidf_matrix)

    # Step 6 (validate before Supabase sync)
    if not validate(df, tfidf_matrix):
        log.error("Validation failed. Aborting Supabase sync.")
        sys.exit(1)

    # Step 4
    supabase = get_supabase()
    sync_tfidf_cache(supabase, vectorizer, tfidf_matrix, df)
    sync_recipes_table(supabase, df)

    print("\n" + "=" * 60)
    print("Pipeline complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
