from __future__ import annotations

import re
import logging
from datetime import date, timedelta
from difflib import get_close_matches

from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# ALIAS MAP — synced with EDA Dataset/clean_ingredients.py
# ═══════════════════════════════════════════════════════════════════════════════

_ALIAS_MAP: dict[str, str] = {
    # chilli
    "cabe rawit merah": "cabai rawit",
    "cabe merah keriting": "cabai merah keriting",
    "cabai merah keriting": "cabai merah keriting",
    "cabai keriting": "cabai merah keriting",
    "cabe merah": "cabai merah",
    "cabe rawit": "cabai rawit",
    "cabe hijau": "cabai hijau",
    "cabe": "cabai",
    "lombok merah": "cabai merah",
    "lombok": "cabai",
    "rawit": "cabai rawit",
    "cabai setan": "cabai rawit",
    # egg
    "telor ayam": "telur ayam",
    "telor bebek": "telur bebek",
    "telor puyuh": "telur puyuh",
    "telor": "telur",
    "putih telor": "putih telur",
    "kuning telor": "kuning telur",
    # spices
    "laos": "lengkuas",
    "sereh": "serai",
    "sere": "serai",
    "jahe merah": "jahe",
    "merica": "lada",
    "merica bubuk": "lada bubuk",
    "lada hitam": "lada hitam",
    # onion
    "baput": "bawang putih",
    "bamer": "bawang merah",
    "bawmer": "bawang merah",
    "bawput": "bawang putih",
    "brambang": "bawang merah",
    "bawang bombai": "bawang bombay",
    "bawang bombay": "bawang bombay",
    "bawang p": "bawang putih",
    "bombay": "bawang bombay",
    # vegetables
    "pete": "petai",
    "touge": "tauge",
    "toge": "tauge",
    "daun bawang": "daun bawang",
    # coconut
    "santen": "santan",
    "santan kental": "santan",
    "santan encer": "santan",
    "kelapa parut": "kelapa",
    # leaves
    "daun jeruk purut": "daun jeruk",
    "daun jeruk wangi": "daun jeruk",
    "jeruk purut": "daun jeruk",
    "daun salm": "daun salam",
    # sugar
    "gula jawa": "gula merah",
    "gula aren": "gula merah",
    "gula merah": "gula merah",
    # sauce
    "saos sambal": "saus sambal",
    "saos tomat": "saus tomat",
    "saos tiram": "saus tiram",
    "saos teriyaki": "saus teriyaki",
    "saos": "saus",
    # flour
    "tapioka": "tepung tapioka",
    "maizena": "tepung maizena",
    "terigu": "tepung terigu",
    # oil
    "minyak": "minyak goreng",
    # misc
    "penyedap rasa": "penyedap",
    "vetsin": "penyedap",
    "micin": "penyedap",
    "msg": "penyedap",
    "masako": "penyedap",
    "royco": "penyedap",
}

# Abbreviation expansion (user input shorthand)
_ABBREV_MAP: dict[str, str] = {
    "bwg": "bawang",
    "bwng": "bawang",
    "russ": "ruas",
    "slera": "selera",
    "sckpnya": "secukupnya",
    "scukupnya": "secukupnya",
}

# Staple ingredients — assumed always available
STAPLE_INGREDIENTS: set[str] = {
    "garam", "gula", "gula pasir", "lada", "lada bubuk", "air",
    "minyak goreng", "kecap manis", "kecap asin", "penyedap",
    "bawang putih", "bawang merah", "saus tiram", "saus sambal",
    "saus tomat", "bawang bombay",
}

# Shelf-life cache
_shelf_life_cache: dict[str, int] | None = None
_shelf_life_full_cache: list[dict] | None = None


# ═══════════════════════════════════════════════════════════════════════════════
# TEXT CLEANING
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_ingredient_name(raw_name: str) -> str:
    cleaned = _clean_text(raw_name)
    if not cleaned:
        return ""

    # Expand abbreviations
    for abbr in sorted(_ABBREV_MAP.keys(), key=len, reverse=True):
        if abbr in cleaned:
            cleaned = cleaned.replace(abbr, _ABBREV_MAP[abbr])
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Exact alias match (longest first)
    for alias in sorted(_ALIAS_MAP.keys(), key=len, reverse=True):
        if alias == cleaned:
            return _ALIAS_MAP[alias]

    # Substring alias match for compound names
    for alias in sorted(_ALIAS_MAP.keys(), key=len, reverse=True):
        if re.search(r"\b" + re.escape(alias) + r"\b", cleaned):
            cleaned = re.sub(r"\b" + re.escape(alias) + r"\b", _ALIAS_MAP[alias], cleaned)
            break

    # Fuzzy match against shelf_life_reference + alias keys
    shelf_life = _load_shelf_life_cache()
    all_known = list(set(list(shelf_life.keys()) + list(_ALIAS_MAP.values())))
    matches = get_close_matches(cleaned, all_known, n=1, cutoff=0.8)
    if matches:
        matched = matches[0]
        if cleaned.split()[0][0] == matched.split()[0][0]:
            return matched

    return cleaned


def is_staple_ingredient(name: str) -> bool:
    normalized = normalize_ingredient_name(name)
    return normalized in STAPLE_INGREDIENTS


# ═══════════════════════════════════════════════════════════════════════════════
# SHELF-LIFE & UNIT SUGGESTION
# ═══════════════════════════════════════════════════════════════════════════════

def _load_shelf_life_cache() -> dict[str, int]:
    global _shelf_life_cache
    if _shelf_life_cache is not None:
        return _shelf_life_cache
    try:
        sb = get_supabase()
        result = sb.table("shelf_life_reference").select("ingredient_name, shelf_life_days").execute()
        _shelf_life_cache = {
            row["ingredient_name"].lower(): row["shelf_life_days"]
            for row in result.data
        }
    except Exception as e:
        logger.warning("Gagal load shelf-life cache: %s", e)
        _shelf_life_cache = _get_default_shelf_life()
    return _shelf_life_cache


def _load_shelf_life_full() -> list[dict]:
    global _shelf_life_full_cache
    if _shelf_life_full_cache is not None:
        return _shelf_life_full_cache
    try:
        sb = get_supabase()
        result = (
            sb.table("shelf_life_reference")
            .select("ingredient_name, shelf_life_days, default_unit, category_id")
            .execute()
        )
        _shelf_life_full_cache = result.data or []
    except Exception as e:
        logger.warning("Gagal load shelf-life full: %s", e)
        _shelf_life_full_cache = []
    return _shelf_life_full_cache


def suggest_unit(item_name: str, category_id: int | None = None) -> dict:
    normalized = normalize_ingredient_name(item_name)
    shelf_data = _load_shelf_life_full()

    def _make_result(row: dict) -> dict:
        return {
            "matched_name": row["ingredient_name"],
            "default_unit": row.get("default_unit", "buah"),
            "shelf_life_days": row.get("shelf_life_days"),
            "category_id": row.get("category_id"),
        }

    # 1. Exact match
    for row in shelf_data:
        if row["ingredient_name"].lower() == normalized:
            return _make_result(row)

    # 2. Substring match: "sapi" matches "daging sapi"
    for row in shelf_data:
        name = row["ingredient_name"].lower()
        if normalized in name or name in normalized:
            return _make_result(row)

    # 3. Fuzzy match (higher cutoff to avoid sapi→sawi)
    names = [r["ingredient_name"].lower() for r in shelf_data]
    matches = get_close_matches(normalized, names, n=1, cutoff=0.8)
    if matches:
        for row in shelf_data:
            if row["ingredient_name"].lower() == matches[0]:
                return _make_result(row)

    # 4. Fallback by category_id if provided
    if category_id is not None:
        for row in shelf_data:
            if row.get("category_id") == category_id:
                return {
                    "matched_name": None,
                    "default_unit": row.get("default_unit", "buah"),
                    "shelf_life_days": None,
                    "category_id": category_id,
                }

    return {
        "matched_name": None,
        "default_unit": "buah",
        "shelf_life_days": None,
        "category_id": None,
    }


def search_ingredients(query: str, limit: int = 10) -> list[dict]:
    q = query.lower().strip()
    if len(q) < 2:
        return []
    shelf_data = _load_shelf_life_full()
    results = []
    for row in shelf_data:
        name = row["ingredient_name"].lower()
        if q in name:
            results.append({
                "ingredient_name": row["ingredient_name"],
                "default_unit": row.get("default_unit", "buah"),
                "shelf_life_days": row.get("shelf_life_days"),
                "category_id": row.get("category_id"),
            })
    # Sort: exact start match first, then alphabetical
    results.sort(key=lambda r: (0 if r["ingredient_name"].lower().startswith(q) else 1, r["ingredient_name"]))
    return results[:limit]


def _get_default_shelf_life() -> dict[str, int]:
    return {
        "bayam": 3, "kangkung": 3, "sawi": 5, "wortel": 14,
        "kentang": 21, "tomat": 7, "brokoli": 5, "kol": 7,
        "cabai merah": 7, "cabai rawit": 7, "cabai hijau": 7,
        "ayam": 2, "daging sapi": 3, "daging kambing": 3,
        "ikan segar": 2, "udang": 2, "telur": 21,
        "tempe": 3, "tahu": 3,
        "bawang merah": 14, "bawang putih": 14, "jahe": 21,
        "kunyit": 14, "lengkuas": 14, "serai": 14,
    }


def estimate_expiry_date(
    item_name: str,
    is_natural: bool = False,
    from_date: date | None = None,
) -> date | None:
    if not is_natural:
        return None

    shelf_life = _load_shelf_life_cache()
    normalized = normalize_ingredient_name(item_name)

    days = shelf_life.get(normalized)

    if days is None and " " in normalized:
        days = shelf_life.get(normalized.split()[0])

    if days is None:
        names = list(shelf_life.keys())
        matches = get_close_matches(normalized, names, n=1, cutoff=0.6)
        if matches:
            days = shelf_life[matches[0]]

    if days is None:
        days = 5

    base = from_date or date.today()
    return base + timedelta(days=days)


def resolve_category_from_shelf_life(item_name: str) -> int | None:
    try:
        sb = get_supabase()
        normalized = normalize_ingredient_name(item_name)
        keyword = normalized.split()[0]
        result = (
            sb.table("shelf_life_reference")
            .select("category_id")
            .ilike("ingredient_name", f"%{keyword}%")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["category_id"]
    except Exception:
        pass
    return None
