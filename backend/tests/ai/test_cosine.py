"""Fase 1 — Unit Test: Cosine Similarity (Content-Based Filtering).

20 query sintetis memvalidasi bahwa TF-IDF + Cosine Similarity
menghasilkan resep relevan untuk berbagai kombinasi bahan.
"""
import pytest

from app.ai.recommender import get_recommendations, InventoryItem

pytestmark = [pytest.mark.unit, pytest.mark.requires_model]

QUERIES = [
    ("ayam_bawang", ["ayam", "bawang putih"], "ayam"),
    ("bayam_telur", ["bayam", "telur"], "bayam"),
    ("tahu_tempe", ["tahu", "tempe"], "tahu"),
    ("ikan_tomat", ["ikan", "tomat"], "ikan"),
    ("udang_bawang", ["udang", "bawang merah"], "udang"),
    ("daging_kentang", ["daging sapi", "kentang"], "daging"),
    ("telur_kecap", ["telur", "kecap"], "telur"),
    ("kangkung_terasi", ["kangkung", "terasi"], "kangkung"),
    ("nasi_goreng", ["nasi", "kecap", "telur"], "nasi"),
    ("mie_sayur", ["mie", "wortel", "sawi"], "mie"),
    ("soto_ayam", ["ayam", "kunyit", "serai"], "ayam"),
    ("rendang", ["daging sapi", "santan", "cabai"], "daging"),
    ("pecel", ["bayam", "kacang", "tauge"], "bayam"),
    ("capcay", ["wortel", "brokoli", "jagung"], "wortel"),
    ("sop_bening", ["bayam", "jagung", "wortel"], "bayam"),
    ("tumis_kangkung", ["kangkung", "bawang putih", "cabai"], "kangkung"),
    ("gulai_ikan", ["ikan", "santan", "kunyit"], "ikan"),
    ("bakso", ["daging sapi", "tepung tapioka"], "bakso"),
    ("sambal_goreng", ["tempe", "cabai merah", "bawang merah"], "tempe"),
    ("tahu_goreng", ["tahu", "bawang putih", "garam"], "tahu"),
]


class TestCosineRelevance:
    """Top-10 harus mengandung keyword relevan untuk setiap query."""

    @pytest.mark.parametrize(
        "name,ingredients,expected_keyword",
        QUERIES,
        ids=[q[0] for q in QUERIES],
    )
    def test_top10_contains_keyword(self, knowledge_base, name, ingredients, expected_keyword):
        items = [InventoryItem(name=ing) for ing in ingredients]
        result = get_recommendations(items, top_k=10, spi_weight=0.0)

        assert len(result.recipes) > 0, f"Tidak ada hasil untuk: {ingredients}"

        found = any(
            expected_keyword.lower() in (r.title + " " + r.ingredients_cleaned).lower()
            for r in result.recipes
        )
        assert found, (
            f"'{expected_keyword}' tidak ditemukan di Top-10. "
            f"Titles: {[r.title for r in result.recipes[:5]]}"
        )


class TestCosineProperties:
    """Validasi properti matematika cosine similarity."""

    def test_scores_positive(self, knowledge_base):
        items = [InventoryItem(name="ayam"), InventoryItem(name="bawang putih")]
        result = get_recommendations(items, top_k=10, spi_weight=0.0)
        for r in result.recipes:
            assert r.cosine_score > 0

    def test_scores_sorted_descending(self, knowledge_base):
        items = [InventoryItem(name="bayam"), InventoryItem(name="telur")]
        result = get_recommendations(items, top_k=10, spi_weight=0.0)
        scores = [r.cosine_score for r in result.recipes]
        assert scores == sorted(scores, reverse=True)

    def test_top_k_respected(self, knowledge_base):
        items = [InventoryItem(name="ayam")]
        for k in [1, 5, 10, 20]:
            result = get_recommendations(items, top_k=k, spi_weight=0.0)
            assert len(result.recipes) <= k

    def test_empty_inventory_no_crash(self, knowledge_base):
        result = get_recommendations([], top_k=5)
        assert isinstance(result.recipes, list)

    def test_match_percentage_in_range(self, knowledge_base):
        items = [InventoryItem(name="ayam"), InventoryItem(name="bawang putih")]
        result = get_recommendations(items, top_k=5, spi_weight=0.0)
        for r in result.recipes:
            assert 0 <= r.match_percentage <= 100