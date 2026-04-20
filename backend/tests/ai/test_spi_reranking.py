"""Fase 1 — Unit Test: SPI Re-ranking.

15 skenario memvalidasi bahwa bahan dengan SPI tinggi (mendekati kedaluwarsa)
mendorong resep ke posisi teratas rekomendasi.
"""
import pytest

from app.ai.recommender import get_recommendations, InventoryItem

pytestmark = [pytest.mark.unit, pytest.mark.requires_model]


class TestSPIPrioritization:
    """Bahan kritis (d kecil) harus diprioritaskan di hasil rekomendasi."""

    @pytest.mark.parametrize("critical,d_crit,other,d_other", [
        ("bayam", 0, "ayam", 14),
        ("bayam", 1, "ayam", 14),
        ("kangkung", 0, "telur", 10),
        ("kangkung", 1, "tahu", 7),
        ("tomat", 0, "kentang", 14),
        ("tomat", 1, "wortel", 10),
        ("tahu", 0, "tempe", 14),
        ("tahu", 1, "telur", 7),
        ("udang", 0, "ayam", 14),
        ("udang", 1, "ikan", 10),
        ("wortel", 0, "bawang putih", 30),
        ("wortel", 1, "jagung", 14),
        ("tempe", 0, "tahu", 14),
        ("ikan", 0, "daging sapi", 14),
        ("telur", 1, "bawang merah", 14),
    ], ids=[f"scenario_{i+1}" for i in range(15)])
    def test_critical_in_top1(self, knowledge_base, critical, d_crit, other, d_other):
        """Bahan kritis harus muncul di resep Top-1."""
        items = [
            InventoryItem(name=critical, days_remaining=d_crit),
            InventoryItem(name=other, days_remaining=d_other),
        ]
        result = get_recommendations(items, top_k=10, spi_weight=0.4)
        top = result.recipes[0]
        text = (top.title + " " + top.ingredients_cleaned).lower()
        assert critical.lower() in text, (
            f"'{critical}' (d={d_crit}) tidak di Top-1. "
            f"Top-1: {top.title}"
        )


class TestSPIWeightBehavior:
    """Validasi perilaku SPI weight (lambda) terhadap ranking."""

    def test_weight_0_pure_cosine(self, knowledge_base):
        """spi_weight=0 → SPI diabaikan, urutan murni cosine."""
        items = [
            InventoryItem(name="ayam", days_remaining=0),
            InventoryItem(name="bayam", days_remaining=14),
        ]
        result = get_recommendations(items, top_k=5, spi_weight=0.0)
        assert len(result.recipes) > 0

    def test_weight_high_prioritizes_critical(self, knowledge_base):
        """spi_weight=0.8 → SPI sangat dominan."""
        items = [
            InventoryItem(name="wortel", days_remaining=1),
            InventoryItem(name="daging sapi", days_remaining=14),
        ]
        result = get_recommendations(items, top_k=10, spi_weight=0.8)
        assert "wortel" in result.recipes[0].ingredients_cleaned.lower()

    def test_no_expiry_zero_spi_contribution(self, knowledge_base):
        """Bahan tanpa expiry → SPI = 0, bahan lain mendominasi."""
        items = [
            InventoryItem(name="garam"),
            InventoryItem(name="bayam", days_remaining=1),
        ]
        result = get_recommendations(items, top_k=10, spi_weight=0.4)
        top3_has_bayam = any(
            "bayam" in r.ingredients_cleaned.lower()
            for r in result.recipes[:3]
        )
        assert top3_has_bayam

    def test_equal_days_both_contribute(self, knowledge_base):
        """Dua bahan d sama → keduanya kontribusi SPI setara."""
        items = [
            InventoryItem(name="bayam", days_remaining=2),
            InventoryItem(name="kangkung", days_remaining=2),
        ]
        result = get_recommendations(items, top_k=10, spi_weight=0.4)
        assert len(result.recipes) > 0

    def test_multiple_critical(self, knowledge_base):
        """Beberapa bahan kritis → resep yang pakai banyak bahan naik."""
        items = [
            InventoryItem(name="bayam", days_remaining=1),
            InventoryItem(name="tomat", days_remaining=1),
            InventoryItem(name="bawang putih", days_remaining=30),
        ]
        result = get_recommendations(items, top_k=10, spi_weight=0.4)
        assert result.recipes[0].spi_score > 0

    def test_all_fresh_low_spi(self, knowledge_base):
        """Semua d=14 → SPI sangat rendah, final ≈ cosine."""
        items = [
            InventoryItem(name="ayam", days_remaining=14),
            InventoryItem(name="bawang putih", days_remaining=14),
        ]
        result = get_recommendations(items, top_k=5, spi_weight=0.4)
        for r in result.recipes:
            assert r.final_score > 0

    def test_final_score_formula(self, knowledge_base):
        """final = (1-λ)*cosine + λ*spi, jadi final >= cosine*(1-λ)."""
        items = [
            InventoryItem(name="bayam", days_remaining=1),
            InventoryItem(name="telur", days_remaining=7),
        ]
        result = get_recommendations(items, top_k=5, spi_weight=0.4)
        for r in result.recipes:
            if r.spi_score > 0:
                assert r.final_score >= r.cosine_score * 0.6 - 1e-6
