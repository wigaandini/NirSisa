"""
update_recipes_v3.py
--------------------
Apply v3 ingredient cleanup to Supabase recipes table.

Match key:  recipes.url  ==  csv.URL  (verified 100% unique)
Updates:    ingredients_cleaned, total_ingredients

Workflow:
  1. Read v3 CSV
  2. Fetch existing recipes from Supabase (id, url, ingredients_cleaned, total_ingredients)
  3. Compute diff (rows that actually changed)
  4. Show preview: counts + 5 random sample diffs
  5. Ask y/N
  6. Batched UPDATE via supabase client
"""

import os
import sys
import csv
import random
from pathlib import Path

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("pip install supabase python-dotenv")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / "database" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in database/.env")
    sys.exit(1)

CSV_PATH = ROOT / "EDA Dataset" / "Indonesian_Food_Recipes_Cleaned_v3.csv"
PAGE_SIZE = 1000  # supabase REST max per request
UPDATE_BATCH = 100


def read_csv() -> dict[str, dict]:
    """Return {url: {ingredients_cleaned, total_ingredients}}."""
    out: dict[str, dict] = {}
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row["URL"].strip()
            if not url:
                continue
            out[url] = {
                "ingredients_cleaned": row["Ingredients Cleaned"].strip(),
                "total_ingredients": int(row["Total Ingredients"]),
            }
    return out


def fetch_existing(sb: Client) -> list[dict]:
    """Page through all recipes."""
    all_rows: list[dict] = []
    offset = 0
    while True:
        res = (
            sb.table("recipes")
            .select("id, url, ingredients_cleaned, total_ingredients")
            .order("id")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break
        all_rows.extend(batch)
        print(f"  fetched {len(all_rows)}...")
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_rows


def main() -> None:
    print("=" * 70)
    print("NirSisa Recipes — v3 Ingredient Cleanup → Supabase")
    print("=" * 70)
    print(f"CSV : {CSV_PATH}")
    print(f"DB  : {SUPABASE_URL}\n")

    print("Reading v3 CSV...")
    csv_map = read_csv()
    print(f"  {len(csv_map)} rows with URL key\n")

    print("Fetching existing recipes from Supabase...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    existing = fetch_existing(sb)
    print(f"  {len(existing)} rows in recipes table\n")

    # Compute diff
    updates: list[dict] = []
    unchanged = 0
    no_csv_match = 0
    for row in existing:
        url = (row.get("url") or "").strip()
        if not url:
            no_csv_match += 1
            continue
        new = csv_map.get(url)
        if not new:
            no_csv_match += 1
            continue
        old_ing = (row.get("ingredients_cleaned") or "").strip()
        old_tot = row.get("total_ingredients") or 0
        if old_ing == new["ingredients_cleaned"] and old_tot == new["total_ingredients"]:
            unchanged += 1
            continue
        updates.append({
            "id": row["id"],
            "url": url,
            "old_ing": old_ing,
            "new_ing": new["ingredients_cleaned"],
            "old_tot": old_tot,
            "new_tot": new["total_ingredients"],
        })

    print("=" * 70)
    print("DRY RUN SUMMARY")
    print("=" * 70)
    print(f"  To update     : {len(updates)}")
    print(f"  Unchanged     : {unchanged}")
    print(f"  No CSV match  : {no_csv_match}")
    print(f"  Total existing: {len(existing)}\n")

    if not updates:
        print("Nothing to update. Exiting.")
        return

    # Show 5 random sample diffs
    print("=" * 70)
    print("SAMPLE DIFFS (5 random)")
    print("=" * 70)
    random.seed(42)
    for u in random.sample(updates, min(5, len(updates))):
        print(f"\nid={u['id']}  url={u['url'][:60]}")
        print(f"  OLD ({u['old_tot']:>2}): {u['old_ing'][:160]}")
        print(f"  NEW ({u['new_tot']:>2}): {u['new_ing'][:160]}")

    # Confirm via CLI flag
    print("\n" + "=" * 70)
    if "--apply" not in sys.argv:
        print(f"DRY RUN ONLY. To commit {len(updates)} UPDATEs, re-run with:")
        print(f"  python database/seed/update_recipes_v3.py --apply")
        return

    # Apply via threaded single-row UPDATE (correct + parallel)
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading
    print(f"\nApplying {len(updates)} updates with 10 worker threads...", flush=True)

    counter_lock = threading.Lock()
    state = {"done": 0, "failed": 0}

    def apply_one(u: dict) -> tuple[bool, str]:
        try:
            sb.table("recipes").update({
                "ingredients_cleaned": u["new_ing"],
                "total_ingredients": u["new_tot"],
            }).eq("id", u["id"]).execute()
            return True, ""
        except Exception as e:
            return False, str(e)

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(apply_one, u): u for u in updates}
        for fut in as_completed(futures):
            ok, err = fut.result()
            with counter_lock:
                if ok:
                    state["done"] += 1
                else:
                    state["failed"] += 1
                total_done = state["done"] + state["failed"]
                if total_done % 200 == 0 or total_done == len(updates):
                    print(f"  {state['done']}/{len(updates)} done ({state['failed']} failed)", flush=True)

    print(f"\nFinished. Updated {state['done']}, failed {state['failed']}.", flush=True)


if __name__ == "__main__":
    main()
