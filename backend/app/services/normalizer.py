from __future__ import annotations

import re
import logging
from datetime import date, timedelta
from difflib import get_close_matches
from typing import Any

from app.core.supabase import get_supabase
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

logger = logging.getLogger(__name__)

# Inisialisasi Stemmer
_factory = StemmerFactory()
_stemmer = _factory.create_stemmer()

# ---------------------------------------------------------------------------
# Konfigurasi Kamus
# ---------------------------------------------------------------------------

# Bahan dasar yang diasumsikan selalu ada di dapur (Staples)
# Sistem tidak akan memberikan tanda 'Error' jika bahan ini tidak ada di stok
STAPLE_INGREDIENTS = {
    "garam", "gula", "lada", "merica", "air", "minyak", "minyak goreng", 
    "kecap", "kecap manis", "kecap asin", "penyedap", "msg", 
    "masako", "royco", "tauco", "maizena", "bawang putih", 
    "bawang merah", "saus tiram", "saus sambal", "saus tomat", "bawang bombay"
}

_ALIAS_MAP: dict[str, str] = {
    "baput": "bawang putih",
    "bamer": "bawang merah",
    "bawmer": "bawang merah",
    "bawput": "bawang putih",
    "bombay": "bawang bombay",
    "cabe": "cabai",
    "telor": "telur",
    "sawi hijau": "sawi",
    "sawi putih": "sawi",
    "saos": "saus",
    "tapioka": "tepung tapioka",
    "maizena": "tepung maizena",
    "minyak": "minyak goreng",
    "lada": "lada bubuk",
    "merica": "lada bubuk",
    "cabe merah": "cabai merah",
    "cabe rawit": "cabai rawit",
    "cabe hijau": "cabai hijau",
    "kacang polong": "kacang polong",
    "kcg": "kacang",
    "kcg polng": "kacang polong",
    "kcg polong": "kacang polong",

}

_shelf_life_cache: dict[str, int] | None = None

# ---------------------------------------------------------------------------
# Fungsi Helper & Logika Utama
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """Pembersihan teks mendalam dengan Stemming."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z\s]", " ", text)
    # Stemming untuk menstandarkan kata (misal: 'bawangan' -> 'bawang')
    text = _stemmer.stem(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def is_staple_ingredient(name: str) -> bool:
    """
    Mengecek apakah suatu bahan termasuk bahan pendukung dasar (staple).
    Akan digunakan oleh service lain untuk memberikan status 'Tersedia' otomatis.
    """
    cleaned = _clean_text(name)
    # Cek apakah ada kata kunci staple di dalam nama bahan
    # Contoh: "1 sdt garam" mengandung "garam" -> True
    return any(staple in cleaned for staple in STAPLE_INGREDIENTS)

def normalize_ingredient_name(raw_name: str) -> str:
    """Normalisasi nama bahan dengan proteksi over-matching."""
    cleaned = _clean_text(raw_name)

    if not cleaned:
        return ""

    # 1. Cek Exact Match di Alias Map
    if cleaned in _ALIAS_MAP:
        return _ALIAS_MAP[cleaned]

    # 2. Bangun Kamus Referensi
    shelf_life_db = _load_shelf_life_cache()
    master_dictionary = list(set(
        list(shelf_life_db.keys()) + 
        list(_get_default_shelf_life().keys()) + 
        list(_ALIAS_MAP.keys())
    ))

    # 3. Fuzzy Match dengan Threshold Ketat (0.8)
    # Gunakan 0.8 agar "sawi" tidak nekat jadi "cabai"
    matches = get_close_matches(cleaned, master_dictionary, n=1, cutoff=0.8)

    if matches:
        matched_word = matches[0]
        # Proteksi Noun: Jika kata pertama berbeda jauh, jangan dipaksakan
        # Mencegah sawi hijau -> cabai hijau
        if cleaned.split()[0][0] == matched_word.split()[0][0]:
            return _ALIAS_MAP.get(matched_word, matched_word)

    return cleaned

def estimate_expiry_date(
    item_name: str,
    is_natural: bool = False,
    from_date: date | None = None,
) -> date | None:
    if not is_natural:
        return None

    shelf_life = _load_shelf_life_cache()
    normalized = normalize_ingredient_name(item_name)
    
    # Cari durasi (days)
    days = shelf_life.get(normalized)

    # Fallback ke kata pertama jika kata majemuk tidak ketemu
    if days is None and " " in normalized:
        days = shelf_life.get(normalized.split()[0])

    if days is None:
        days = 5 # Default jika benar-benar tidak dikenal

    base = from_date or date.today()
    return base + timedelta(days=days)

# ---------------------------------------------------------------------------
# Database Sync
# ---------------------------------------------------------------------------

def _load_shelf_life_cache() -> dict[str, int]:
    global _shelf_life_cache
    if _shelf_life_cache is not None:
        return _shelf_life_cache
    try:
        sb = get_supabase()
        result = sb.table("shelf_life_reference").select("*").execute()
        _shelf_life_cache = {row["ingredient_name"].lower(): row["shelf_life_days"] for row in result.data}
    except:
        _shelf_life_cache = _get_default_shelf_life()
    return _shelf_life_cache

def _get_default_shelf_life() -> dict[str, int]:
    return {
        "sayur": 3, "bayam": 2, "kangkung": 2, "sawi": 3, 
        "wortel": 7, "ayam": 2, "daging": 3, "telur": 21,
        "tempe": 2, "tahu": 3, "susu": 5, "cabai": 7, "ikan": 2
    }

def resolve_category_from_shelf_life(item_name: str) -> int | None:
    try:
        sb = get_supabase()
        normalized = normalize_ingredient_name(item_name)
        keyword = normalized.split()[0]
        result = sb.table("shelf_life_reference").select("category_id").ilike("ingredient_name", f"%{keyword}%").limit(1).execute()
        if result.data:
            return result.data[0]["category_id"]
    except:
        pass
    return None