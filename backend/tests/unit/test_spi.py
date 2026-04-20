"""Fase 1 — Unit Test: Spoilage Proximity Index.

Validasi 15 skenario SPI sesuai spesifikasi evaluasi.
Rumus: SPI = 1 / (d + 1)^alpha, alpha default = 2.0
"""
import pytest
import numpy as np
from datetime import date, timedelta

from app.ai.spi import (
    calculate_spi,
    calculate_spi_batch,
    days_until_expiry,
    freshness_status,
)

pytestmark = pytest.mark.unit


# ═══════════════════════════════════════════════════════════════════════════════
# A. SPI Formula — 15 skenario
# ═══════════════════════════════════════════════════════════════════════════════

class TestSPIFormula:
    """Validasi rumus SPI = 1 / (d + 1)^alpha."""

    @pytest.mark.parametrize("days,expected", [
        (0, 1.0),             # kedaluwarsa hari ini
        (1, 0.25),            # 1/(2^2)
        (2, 1/9),             # 1/(3^2)
        (3, 0.0625),          # 1/(4^2)
        (5, 1/36),            # 1/(6^2)
        (7, 0.015625),        # 1/(8^2)
        (14, 1/225),          # 1/(15^2)
    ], ids=["d=0", "d=1", "d=2", "d=3", "d=5", "d=7", "d=14"])
    def test_spi_known_values(self, days, expected):
        assert abs(calculate_spi(days) - expected) < 1e-10

    def test_spi_negative_clamps_to_zero(self):
        """Bahan expired (d<0) → tetap SPI=1.0."""
        assert calculate_spi(-1) == 1.0
        assert calculate_spi(-5) == 1.0

    def test_spi_custom_alpha(self):
        """Alpha=1.0 → SPI = 1/(d+1)."""
        assert calculate_spi(4, alpha=1.0) == 0.2

    def test_spi_large_days(self):
        """d=30 → SPI sangat kecil tapi > 0."""
        result = calculate_spi(30)
        assert 0 < result < 0.002

    def test_spi_monotonically_decreasing(self):
        """SPI harus menurun seiring bertambahnya hari."""
        scores = [calculate_spi(d) for d in range(15)]
        for i in range(1, len(scores)):
            assert scores[i] < scores[i - 1]

    def test_spi_batch_matches_single(self):
        """Batch calculation identik dengan single."""
        days = np.array([0, 1, 3, 7, 14])
        batch = calculate_spi_batch(days)
        singles = np.array([calculate_spi(d) for d in days])
        np.testing.assert_array_almost_equal(batch, singles)

    def test_spi_batch_negative_clamped(self):
        """Batch: negatif di-clamp ke 0 → SPI=1.0."""
        batch = calculate_spi_batch(np.array([-1, -5, 0]))
        assert batch[0] == 1.0
        assert batch[1] == 1.0
        assert batch[2] == 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# B. Days Until Expiry
# ═══════════════════════════════════════════════════════════════════════════════

class TestDaysUntilExpiry:
    _TODAY = date(2026, 4, 21)

    def test_future(self):
        assert days_until_expiry(date(2026, 4, 24), self._TODAY) == 3

    def test_today(self):
        assert days_until_expiry(self._TODAY, self._TODAY) == 0

    def test_past(self):
        assert days_until_expiry(date(2026, 4, 19), self._TODAY) == -2

    def test_none_returns_none(self):
        assert days_until_expiry(None) is None


# ═══════════════════════════════════════════════════════════════════════════════
# C. Freshness Status
# ═══════════════════════════════════════════════════════════════════════════════

class TestFreshnessStatus:
    @pytest.mark.parametrize("days,expected", [
        (10, "fresh"), (6, "fresh"),
        (5, "warning"), (3, "warning"), (2, "warning"),
        (1, "critical"), (0, "critical"), (-1, "critical"),
        (None, "unknown"),
    ])
    def test_status_mapping(self, days, expected):
        assert freshness_status(days) == expected
