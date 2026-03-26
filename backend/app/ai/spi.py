# SPI = 1 / (d + 1)^alpha
#   d   = sisa hari sebelum kedaluwarsa
#   alpha = decay factor (default 2.0)
# Semakin kecil d, semakin besar SPI -> bahan harus segera digunakan

from __future__ import annotations

import numpy as np
from datetime import date


def calculate_spi(days_remaining: int, alpha: float = 2.0) -> float:
    # Hitung SPI untuk satu bahan
    # Args:
    #     days_remaining: Sisa hari menuju kedaluwarsa (bisa negatif jika sudah lewat)
    #     alpha: Eksponen peluruhan Semakin besar, semakin tajam kurva urgensi

    # Returns:
    #     Skor SPI antara 0..1, nilai 1.0 berarti d=0 (kedaluwarsa hari ini)

    d = max(days_remaining, 0)
    return 1.0 / ((d + 1) ** alpha)


def calculate_spi_batch(days_array: np.ndarray, alpha: float = 2.0) -> np.ndarray:
    # Hitung SPI secara vektorisasi untuk array sisa hari
    d = np.maximum(days_array, 0).astype(float)
    return 1.0 / ((d + 1) ** alpha)


def days_until_expiry(expiry_date: date | None, today: date | None = None) -> int | None:
    # Hitung selisih hari antara hari ini dan tanggal kedaluwarsa

    # Returns:
    #     None jika expiry_date tidak tersedia; int jika tersedia.
    
    if expiry_date is None:
        return None
    if today is None:
        today = date.today()
    return (expiry_date - today).days


def freshness_status(days_remaining: int | None) -> str:
    # Tentukan label freshness berdasarkan sisa hari.

    # Hijau  (>5 hari)  → 'fresh'
    # Kuning (2-5 hari)  → 'warning'
    # Merah  (<=2 hari)  → 'critical'
    # Abu-abu (unknown)  → 'unknown'
    
    if days_remaining is None:
        return "unknown"
    if days_remaining > 5:
        return "fresh"
    if days_remaining >= 2:
        return "warning"
    return "critical"
