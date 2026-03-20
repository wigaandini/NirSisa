"""Seed recipes from cleaned CSV into Supabase."""

import os
import sys
import csv
from pathlib import Path

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("pip install supabase python-dotenv")
    sys.exit(1)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in database/.env")
    sys.exit(1)

CSV_PATH = Path(__file__).resolve().parent.parent.parent / "EDA Dataset" / "Indonesian_Food_Recipes_Cleaned.csv"

BATCH_SIZE = 500


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def seed_categories(supabase: Client) -> dict[str, int]:
    categories = ["ayam", "ikan", "kambing", "sapi", "tahu", "telur", "tempe", "udang"]

    for cat in categories:
        supabase.table("recipe_categories").upsert(
            {"name": cat}, on_conflict="name"
        ).execute()

    result = supabase.table("recipe_categories").select("id, name").execute()
    return {row["name"]: row["id"] for row in result.data}


def read_csv() -> list[dict]:
    recipes = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            recipes.append({
                "title": row["Title"].strip(),
                "title_cleaned": row["Title Cleaned"].strip(),
                "ingredients": row["Ingredients"].strip(),
                "ingredients_cleaned": row["Ingredients Cleaned"].strip(),
                "steps": row["Steps"].strip(),
                "total_ingredients": int(row["Total Ingredients"]),
                "total_steps": int(row["Total Steps"]),
                "loves": int(row["Loves"]),
                "url": row["URL"].strip(),
                "category": row["Category"].strip().lower(),
            })
    return recipes


def seed_recipes(supabase: Client, cat_map: dict[str, int]):
    recipes = read_csv()
    print(f"Read {len(recipes)} recipes from CSV")

    count_result = supabase.table("recipes").select("id", count="exact").limit(1).execute()
    existing_count = count_result.count or 0
    if existing_count > 0:
        print(f"WARNING: recipes table already has {existing_count} rows.")
        answer = input("Continue and add more? (y/N): ").strip().lower()
        if answer != "y":
            print("Skipped recipe seeding.")
            return

    total = len(recipes)
    for i in range(0, total, BATCH_SIZE):
        batch = recipes[i : i + BATCH_SIZE]
        rows = []
        for r in batch:
            cat_id = cat_map.get(r["category"])
            if cat_id is None:
                print(f"  WARNING: Unknown category '{r['category']}' for '{r['title']}', skipping")
                continue
            rows.append({
                "title": r["title"],
                "title_cleaned": r["title_cleaned"],
                "ingredients": r["ingredients"],
                "ingredients_cleaned": r["ingredients_cleaned"],
                "steps": r["steps"],
                "total_ingredients": r["total_ingredients"],
                "total_steps": r["total_steps"],
                "loves": r["loves"],
                "url": r["url"],
                "category_id": cat_id,
            })

        if rows:
            supabase.table("recipes").insert(rows).execute()

        done = min(i + BATCH_SIZE, total)
        print(f"  Inserted {done}/{total} recipes...")

    print("Recipe seeding complete!")


def main():
    print("NirSisa Recipe Seeder")
    print("=" * 40)
    print(f"CSV path: {CSV_PATH}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print()

    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}")
        sys.exit(1)

    supabase = get_supabase()

    print("1. Seeding recipe categories...")
    cat_map = seed_categories(supabase)
    print(f"   Categories: {cat_map}")

    print("2. Seeding recipes...")
    seed_recipes(supabase, cat_map)

    print("\nDone!")


if __name__ == "__main__":
    main()
