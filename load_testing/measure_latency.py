"""
Pengukuran Latency /recommend — NirSisa
========================================
Mengukur:
  1. Latency per skenario top_k (3, 5, 10 rekomendasi → proxy variasi bahan)
  2. Efektivitas caching (cold vs warm request)
  3. Statistik lengkap per skenario

Jalankan: python3 measure_latency.py
"""

import os
import time
import statistics
import requests

TOKEN = os.getenv("NIRSISA_TOKEN", "GANTI_TOKEN")
BASE  = "https://nirsisa-production.up.railway.app"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
N_PER_SCENARIO = 20


def measure_single(top_k: int):
    start = time.perf_counter()
    try:
        res = requests.get(
            f"{BASE}/recommend",
            headers=HEADERS,
            params={"top_k": top_k},
            timeout=30,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        if res.status_code == 200:
            data = res.json()
            return {
                "http_ms": elapsed_ms,
                "engine_ms": data.get("latency_ms"),
                "n_recipes": len(data.get("recommendations", [])),
            }
        return None
    except Exception:
        return None


def print_stats(label: str, data: list[float]) -> None:
    if not data:
        print(f"  {label}: tidak ada data")
        return
    s = sorted(data)
    n = len(s)
    p50 = s[int(n * 0.50)]
    p95 = s[min(int(n * 0.95), n - 1)]
    p99 = s[min(int(n * 0.99), n - 1)]
    avg = statistics.mean(s)

    # Target check
    p50_ok = "✓" if p50 < 300 else "✗"
    p95_ok = "✓" if p95 < 500 else "✗"

    print(f"    Min    : {min(s):8.1f} ms")
    print(f"    Avg    : {avg:8.1f} ms")
    print(f"    p50    : {p50:8.1f} ms  {p50_ok} (target <300ms)")
    print(f"    p95    : {p95:8.1f} ms  {p95_ok} (target <500ms)")
    print(f"    p99    : {p99:8.1f} ms")
    print(f"    Max    : {max(s):8.1f} ms")


# ═══════════════════════════════════════════════════════════════════
# BAGIAN 1: Variasi top_k (proxy untuk variasi jumlah bahan)
# ═══════════════════════════════════════════════════════════════════
print("=" * 60)
print("SKENARIO 1 — Variasi Jumlah Rekomendasi (top_k: 3, 5, 10)")
print("=" * 60)

scenarios = [
    (5,  "Sedikit  (top_k=5 )"),
    (10, "Sedang   (top_k=10)"),
    (20, "Banyak   (top_k=20)"),
]

for top_k, label in scenarios:
    print(f"\n▶ {label}")
    http_times, engine_times = [], []

    for i in range(1, N_PER_SCENARIO + 1):
        r = measure_single(top_k)
        if r:
            http_times.append(r["http_ms"])
            if r["engine_ms"]:
                engine_times.append(r["engine_ms"])
            tag = " ← cold" if i == 1 else ""
            print(f"   [{i:02d}] HTTP {r['http_ms']:7.1f}ms | Engine {r['engine_ms'] or '?':>7}ms{tag}")

    # Hapus request pertama (cold start) dari statistik
    warm_http   = http_times[1:]
    warm_engine = engine_times[1:]

    print(f"\n  ── HTTP Latency (warm, request ke-2 s/d {N_PER_SCENARIO}) ──")
    print_stats(label, warm_http)
    print(f"  ── Engine Latency (ML saja, warm) ──")
    print_stats(label, warm_engine)
    if http_times and engine_times:
        overhead = statistics.mean(http_times) - statistics.mean(engine_times)
        print(f"  Network overhead rata-rata: {overhead:.1f} ms")


# ═══════════════════════════════════════════════════════════════════
# BAGIAN 2: Cache effectiveness (cold vs warm)
# ═══════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("SKENARIO 2 — Efektivitas Cache (Cold vs Warm)")
print("=" * 60)

print("\nMengirim 1 cold request + 10 warm request ...\n")

cold = measure_single(20)
if cold:
    print(f"  [COLD] HTTP {cold['http_ms']:7.1f}ms | Engine {cold['engine_ms'] or '?'}ms")

warm_http, warm_engine = [], []
for i in range(1, 11):
    r = measure_single(20)
    if r:
        warm_http.append(r["http_ms"])
        if r["engine_ms"]:
            warm_engine.append(r["engine_ms"])
        print(f"  [WARM {i:02d}] HTTP {r['http_ms']:7.1f}ms | Engine {r['engine_ms'] or '?'}ms")

if cold and warm_http:
    avg_warm = statistics.mean(warm_http)
    speedup = cold["http_ms"] / avg_warm
    print(f"\n  Cold  : {cold['http_ms']:.1f} ms")
    print(f"  Warm avg : {avg_warm:.1f} ms")
    print(f"  Speedup  : {speedup:.2f}x lebih cepat setelah cache warm")
    cache_effective = speedup > 1.2
    print(f"  Cache efektif: {'YA ✓' if cache_effective else 'TIDAK / MINIMAL ✗'}")

print("\n" + "=" * 60)
print("SELESAI")
print("=" * 60)
