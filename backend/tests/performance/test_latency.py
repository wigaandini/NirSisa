"""Fase 3 — Performance Test: Latency Benchmarks.

Mengukur latency rekomendasi pada berbagai jumlah bahan input (3, 5, 7, 10).
Target: p50 < 300ms, p95 < 500ms, max < 1000ms.
"""
import pytest
import numpy as np

from app.ai.recommender import get_recommendations, InventoryItem

pytestmark = [pytest.mark.performance, pytest.mark.requires_model]

# Konfigurasi bahan untuk setiap tingkat kompleksitas
COMPLEXITY_LEVELS = {
    "3_bahan": [
        InventoryItem(name="ayam", days_remaining=2),
        InventoryItem(name="bawang putih", days_remaining=10),
        InventoryItem(name="tomat", days_remaining=3),
    ],
    "5_bahan": [
        InventoryItem(name="ayam", days_remaining=2),
        InventoryItem(name="bayam", days_remaining=1),
        InventoryItem(name="bawang putih", days_remaining=10),
        InventoryItem(name="telur", days_remaining=7),
        InventoryItem(name="tomat", days_remaining=3),
    ],
    "7_bahan": [
        InventoryItem(name="ayam", days_remaining=2),
        InventoryItem(name="bayam", days_remaining=1),
        InventoryItem(name="bawang putih", days_remaining=10),
        InventoryItem(name="telur", days_remaining=7),
        InventoryItem(name="tomat", days_remaining=3),
        InventoryItem(name="wortel", days_remaining=5),
        InventoryItem(name="tahu", days_remaining=2),
    ],
    "10_bahan": [
        InventoryItem(name="ayam", days_remaining=2),
        InventoryItem(name="bayam", days_remaining=1),
        InventoryItem(name="bawang putih", days_remaining=10),
        InventoryItem(name="telur", days_remaining=7),
        InventoryItem(name="tomat", days_remaining=3),
        InventoryItem(name="wortel", days_remaining=5),
        InventoryItem(name="tahu", days_remaining=2),
        InventoryItem(name="tempe", days_remaining=3),
        InventoryItem(name="kangkung", days_remaining=1),
        InventoryItem(name="cabai merah", days_remaining=4),
    ],
}

RUNS_PER_LEVEL = 20  # 20 request per konfigurasi


def _benchmark(items: list[InventoryItem], runs: int = RUNS_PER_LEVEL) -> dict:
    """Jalankan rekomendasi N kali dan hitung statistik latency."""
    latencies = []
    for _ in range(runs):
        result = get_recommendations(items, top_k=10, spi_weight=0.4)
        latencies.append(result.latency_ms)

    arr = np.array(latencies)
    return {
        "p50": float(np.percentile(arr, 50)),
        "p95": float(np.percentile(arr, 95)),
        "min": float(arr.min()),
        "max": float(arr.max()),
        "mean": float(arr.mean()),
        "std": float(arr.std()),
        "runs": runs,
    }


class TestLatencyPerComplexity:
    """Benchmark latency per tingkat kompleksitas bahan."""

    @pytest.mark.parametrize("level_name", COMPLEXITY_LEVELS.keys())
    def test_p50_under_300ms(self, knowledge_base, level_name):
        items = COMPLEXITY_LEVELS[level_name]
        stats = _benchmark(items)
        print(f"\n  [{level_name}] p50={stats['p50']:.0f}ms  p95={stats['p95']:.0f}ms  "
              f"mean={stats['mean']:.0f}ms  max={stats['max']:.0f}ms")
        assert stats["p50"] < 300, f"p50 = {stats['p50']:.0f}ms (target < 300ms)"

    @pytest.mark.parametrize("level_name", COMPLEXITY_LEVELS.keys())
    def test_p95_under_500ms(self, knowledge_base, level_name):
        items = COMPLEXITY_LEVELS[level_name]
        stats = _benchmark(items)
        assert stats["p95"] < 500, f"p95 = {stats['p95']:.0f}ms (target < 500ms)"

    @pytest.mark.parametrize("level_name", COMPLEXITY_LEVELS.keys())
    def test_max_under_1000ms(self, knowledge_base, level_name):
        items = COMPLEXITY_LEVELS[level_name]
        stats = _benchmark(items)
        assert stats["max"] < 1000, f"max = {stats['max']:.0f}ms (target < 1000ms)"


class TestLatencySummary:
    """Cetak ringkasan benchmark seluruh tingkat kompleksitas."""

    def test_print_benchmark_table(self, knowledge_base):
        print(f"\n{'='*70}")
        print(f"  BENCHMARK LATENCY — {RUNS_PER_LEVEL} runs per konfigurasi")
        print(f"{'='*70}")
        print(f"  {'Level':<12} {'p50':>7} {'p95':>7} {'mean':>7} {'max':>7} {'Status':>8}")
        print(f"  {'-'*52}")

        all_pass = True
        for name, items in COMPLEXITY_LEVELS.items():
            s = _benchmark(items)
            ok = s["p50"] < 300 and s["p95"] < 500
            status = "PASS" if ok else "FAIL"
            if not ok:
                all_pass = False
            print(f"  {name:<12} {s['p50']:>6.0f}ms {s['p95']:>6.0f}ms "
                  f"{s['mean']:>6.0f}ms {s['max']:>6.0f}ms {status:>8}")

        print(f"{'='*70}")
        assert all_pass, "Satu atau lebih konfigurasi melebihi batas latency"
