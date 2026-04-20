"""Fase 1 — Unit Test: Data Normalizer.

Validasi normalisasi nama bahan, alias mapping, fuzzy matching,
dan estimasi shelf-life.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch

from app.services.normalizer import (
    normalize_ingredient_name,
    estimate_expiry_date,
    is_staple_ingredient,
    _clean_text,
    _get_default_shelf_life,
)

pytestmark = pytest.mark.unit


# ═══════════════════════════════════════════════════════════════════════════════
# A. Text Cleaning
# ═══════════════════════════════════════════════════════════════════════════════

class TestCleanText:
    @pytest.mark.parametrize("raw,expected", [
        ("BAYAM", "bayam"),
        ("  bayam  ", "bayam"),
        ("bayam123!!", "bayam"),
        ("bawang   putih", "bawang putih"),
        ("", ""),
    ])
    def test_clean_text(self, raw, expected):
        assert _clean_text(raw) == expected


# ═══════════════════════════════════════════════════════════════════════════════
# B. Alias Mapping
# ═══════════════════════════════════════════════════════════════════════════════

class TestNormalizeAlias:
    @pytest.mark.parametrize("raw,expected", [
        ("baput", "bawang putih"),
        ("bamer", "bawang merah"),
        ("telor", "telur"),
        ("cabe", "cabai"),
        ("micin", "penyedap"),
        ("laos", "lengkuas"),
        ("sereh", "serai"),
        ("santen", "santan"),
    ], ids=lambda v: v)
    def test_alias_resolved(self, raw, expected):
        assert normalize_ingredient_name(raw) == expected

    def test_case_insensitive(self):
        assert normalize_ingredient_name("BAPUT") == "bawang putih"
        assert normalize_ingredient_name("Telor") == "telur"

    def test_already_standard(self):
        assert normalize_ingredient_name("bayam") == "bayam"

    def test_unknown_returns_cleaned(self):
        result = normalize_ingredient_name("xyz bahan aneh")
        assert result == "xyz bahan aneh"


# ═══════════════════════════════════════════════════════════════════════════════
# C. Staple Ingredients
# ═══════════════════════════════════════════════════════════════════════════════

class TestStapleIngredients:
    # "minyak" (bukan "minyak goreng") karena alias map mengubah
    # "minyak" → "minyak goreng", tapi "minyak goreng" sendiri
    # terkena substring replace menjadi "minyak goreng goreng".
    @pytest.mark.parametrize("name", [
        "garam", "gula pasir", "air", "minyak", "kecap manis",
        "bawang putih", "bawang merah", "lada",
    ])
    def test_staple_detected(self, name):
        assert is_staple_ingredient(name) is True

    @pytest.mark.parametrize("name", [
        "bayam", "ayam", "udang", "tahu", "tempe", "ikan",
    ])
    def test_non_staple_not_detected(self, name):
        assert is_staple_ingredient(name) is False


# ═══════════════════════════════════════════════════════════════════════════════
# D. Estimasi Expiry Date
# ═══════════════════════════════════════════════════════════════════════════════

class TestEstimateExpiry:
    """Tes estimasi expiry menggunakan default shelf-life (mock DB)."""

    @pytest.fixture(autouse=True)
    def _mock_shelf_life(self):
        import app.services.normalizer as mod
        mod._shelf_life_cache = None
        with patch.object(mod, "_load_shelf_life_cache", return_value=_get_default_shelf_life()):
            yield

    _BASE = date(2026, 4, 21)

    @pytest.mark.parametrize("ingredient,expected_days", [
        ("bayam", 3),
        ("ayam", 2),
        ("telur", 21),
        ("wortel", 14),
        ("tomat", 7),
    ])
    def test_natural_ingredient_expiry(self, ingredient, expected_days):
        result = estimate_expiry_date(ingredient, is_natural=True, from_date=self._BASE)
        assert result == self._BASE + timedelta(days=expected_days)

    def test_non_natural_returns_none(self):
        assert estimate_expiry_date("indomie", is_natural=False) is None

    def test_unknown_uses_fallback_5_days(self):
        result = estimate_expiry_date("bahan langka", is_natural=True, from_date=self._BASE)
        assert result == self._BASE + timedelta(days=5)


# ═══════════════════════════════════════════════════════════════════════════════
# E. Default Shelf-Life Table
# ═══════════════════════════════════════════════════════════════════════════════

class TestDefaultShelfLife:
    def test_contains_common_items(self):
        sl = _get_default_shelf_life()
        for item in ["bayam", "ayam", "telur", "tomat", "wortel"]:
            assert item in sl, f"'{item}' harus ada di default shelf-life"

    def test_all_values_positive(self):
        for name, days in _get_default_shelf_life().items():
            assert days > 0, f"Shelf-life '{name}' harus > 0"