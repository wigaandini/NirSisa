# Unit Tests – Spoilage Proximity Index
# Validasi 15 skenario SPI sesuai spesifikasi evaluasi: sisa hari 0, 1, 2, 3, 5, 7, 14 serta edge cases

import pytest
from datetime import date, timedelta

from app.ai.spi import (
    calculate_spi,
    calculate_spi_batch,
    days_until_expiry,
    freshness_status,
)
import numpy as np


class TestCalculateSPI:
    # Validasi rumus SPI = 1 / (d + 1)^alpha, alpha=2.0 

    def test_spi_day_0(self):
        # Kedaluwarsa hari ini → SPI = 1.0 
        assert calculate_spi(0) == 1.0

    def test_spi_day_1(self):
        # Sisa 1 hari → SPI = 1/(2^2) = 0.25 
        assert calculate_spi(1) == 0.25

    def test_spi_day_2(self):
        # Sisa 2 hari → SPI = 1/(3^2) ≈ 0.1111 
        assert abs(calculate_spi(2) - 1 / 9) < 1e-10

    def test_spi_day_3(self):
        # Sisa 3 hari → SPI = 1/(4^2) = 0.0625 
        assert calculate_spi(3) == 0.0625

    def test_spi_day_5(self):
        # Sisa 5 hari → SPI = 1/(6^2) ≈ 0.0278 
        assert abs(calculate_spi(5) - 1 / 36) < 1e-10

    def test_spi_day_7(self):
        # Sisa 7 hari → SPI = 1/(8^2) = 0.015625 
        assert calculate_spi(7) == 0.015625

    def test_spi_day_14(self):
        # Sisa 14 hari → SPI = 1/(15^2) ≈ 0.00444 
        assert abs(calculate_spi(14) - 1 / 225) < 1e-10

    def test_spi_negative_days_clamps_to_zero(self):
        # Bahan sudah expired (d=-2) → tetap SPI=1.0 (clamp ke d=0) 
        assert calculate_spi(-2) == 1.0

    def test_spi_custom_alpha(self):
        # Alpha=1.0 → SPI = 1/(d+1)^1 
        assert calculate_spi(4, alpha=1.0) == 0.2

    def test_spi_large_days(self):
        # Sisa 30 hari → SPI sangat kecil 
        result = calculate_spi(30)
        assert result < 0.002
        assert result > 0

    def test_spi_monotonically_decreasing(self):
        # SPI harus menurun seiring bertambahnya hari 
        scores = [calculate_spi(d) for d in range(15)]
        for i in range(1, len(scores)):
            assert scores[i] < scores[i - 1], f"SPI harus turun: d={i}"

    def test_spi_batch(self):
        # Batch calculation harus sama dengan single 
        days = np.array([0, 1, 3, 7, 14])
        batch = calculate_spi_batch(days)
        singles = np.array([calculate_spi(d) for d in days])
        np.testing.assert_array_almost_equal(batch, singles)

    def test_spi_batch_negative(self):
        # Batch juga clamp negatif ke 0 
        days = np.array([-1, -5, 0, 3])
        batch = calculate_spi_batch(days)
        assert batch[0] == 1.0
        assert batch[1] == 1.0


class TestDaysUntilExpiry:
    def test_future_date(self):
        today = date(2026, 3, 26)
        expiry = date(2026, 3, 29)
        assert days_until_expiry(expiry, today) == 3

    def test_today(self):
        today = date(2026, 3, 26)
        assert days_until_expiry(today, today) == 0

    def test_past_date(self):
        today = date(2026, 3, 26)
        expiry = date(2026, 3, 24)
        assert days_until_expiry(expiry, today) == -2

    def test_none_expiry(self):
        assert days_until_expiry(None) is None


class TestFreshnessStatus:
    def test_fresh(self):
        assert freshness_status(10) == "fresh"
        assert freshness_status(6) == "fresh"

    def test_warning(self):
        assert freshness_status(5) == "warning"
        assert freshness_status(3) == "warning"
        assert freshness_status(2) == "warning"

    def test_critical(self):
        assert freshness_status(1) == "critical"
        assert freshness_status(0) == "critical"
        assert freshness_status(-1) == "critical"

    def test_unknown(self):
        assert freshness_status(None) == "unknown"
