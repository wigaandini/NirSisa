"""Evaluasi Model AI — Metrik Keberhasilan.

Mengukur:
1. Precision@K >= 0.70
2. Recall@K >= 0.50
3. F1-Score >= 0.60
4. Rata-rata Cosine Similarity >= 0.30
5. SPI Accuracy (Hit Rate) >= 0.90

Recall dihitung terhadap retrieval pool Top-N (N=20) karena sistem
CBF bersifat unsupervised tanpa label ground truth manual.
"""
import pytest
import numpy as np

from app.ai.recommender import get_recommendations, InventoryItem

pytestmark = [pytest.mark.evaluation, pytest.mark.requires_model]

# ─── Konfigurasi ──────────────────────────────────────────────────────────────

K = 10
N = 20  # retrieval pool untuk denominator Recall
RELEVANCE_THRESHOLD = 0.5  # >= 50% bahan input cocok = relevan

# ─── 20 Query Sintetis ───────────────────────────────────────────────────────

QUERIES = [
    ("ayam_bawang", ["ayam", "bawang putih"], ["ayam", "bawang putih"]),
    ("bayam_telur", ["bayam", "telur"], ["bayam", "telur"]),
    ("tahu_tempe", ["tahu", "tempe"], ["tahu", "tempe"]),
    ("ikan_tomat", ["ikan", "tomat"], ["ikan", "tomat"]),
    ("udang_bawang", ["udang", "bawang merah"], ["udang", "bawang merah"]),
    ("daging_kentang", ["daging sapi", "kentang"], ["daging", "kentang"]),
    ("telur_kecap", ["telur", "kecap"], ["telur", "kecap"]),
    ("kangkung_terasi", ["kangkung", "terasi"], ["kangkung", "terasi"]),
    ("nasi_goreng", ["nasi", "kecap", "telur"], ["nasi", "kecap", "telur"]),
    ("mie_sayur", ["mie", "wortel", "sawi"], ["mie", "wortel", "sawi"]),
    ("soto_ayam", ["ayam", "kunyit", "serai"], ["ayam", "kunyit", "serai"]),
    ("rendang", ["daging sapi", "santan", "cabai"], ["daging", "santan", "cabai"]),
    ("pecel", ["bayam", "kacang", "tauge"], ["bayam", "kacang", "tauge"]),
    ("capcay", ["wortel", "brokoli", "jagung"], ["wortel", "brokoli", "jagung"]),
    ("sop_bening", ["bayam", "jagung", "wortel"], ["bayam", "jagung", "wortel"]),
    ("tumis_kangkung", ["kangkung", "bawang putih", "cabai"], ["kangkung", "bawang putih", "cabai"]),
    ("gulai_ikan", ["ikan", "santan", "kunyit"], ["ikan", "santan", "kunyit"]),
    ("bakso", ["daging sapi", "tepung tapioka"], ["daging", "tepung"]),
    ("pisang_goreng", ["pisang", "tepung"], ["pisang", "tepung"]),
    ("tahu_goreng", ["tahu", "bawang putih", "garam"], ["tahu", "bawang putih", "garam"]),
]

# ─── 15 Skenario SPI ─────────────────────────────────────────────────────────

SPI_SCENARIOS = [
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
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _is_relevant(recipe, keywords: list[str]) -> bool:
    text = (recipe.title + " " + recipe.ingredients_cleaned).lower()
    matched = sum(1 for kw in keywords if kw.lower() in text)
    return (matched / len(keywords)) >= RELEVANCE_THRESHOLD if keywords else False


@pytest.fixture(scope="module")
def eval_metrics(knowledge_base):
    """Hitung semua metrik sekali, share ke seluruh test dalam module."""
    # Precision & Recall
    all_precision, all_recall = [], []
    all_cosine = []

    for _, ingredients, keywords in QUERIES:
        items = [InventoryItem(name=ing) for ing in ingredients]
        result = get_recommendations(items, top_k=N, spi_weight=0.0)

        rel_topk = sum(1 for r in result.recipes[:K] if _is_relevant(r, keywords))
        rel_topn = sum(1 for r in result.recipes[:N] if _is_relevant(r, keywords))

        all_precision.append(rel_topk / K)
        all_recall.append(rel_topk / rel_topn if rel_topn > 0 else 1.0)

        for r in result.recipes[:K]:
            all_cosine.append(r.cosine_score)

    precision = float(np.mean(all_precision))
    recall = float(np.mean(all_recall))
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    avg_cosine = float(np.mean(all_cosine))

    # SPI Accuracy
    hits = 0
    for critical, d_crit, other, d_other in SPI_SCENARIOS:
        items = [
            InventoryItem(name=critical, days_remaining=d_crit),
            InventoryItem(name=other, days_remaining=d_other),
        ]
        result = get_recommendations(items, top_k=K, spi_weight=0.4)
        text = (result.recipes[0].title + " " + result.recipes[0].ingredients_cleaned).lower()
        if critical.lower() in text:
            hits += 1
    spi_accuracy = hits / len(SPI_SCENARIOS)

    # Latency
    latencies = []
    for _, ingredients, _ in QUERIES:
        items = [InventoryItem(name=i, days_remaining=3) for i in ingredients]
        result = get_recommendations(items, top_k=K, spi_weight=0.4)
        latencies.append(result.latency_ms)

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "avg_cosine": avg_cosine,
        "spi_accuracy": spi_accuracy,
        "spi_hits": hits,
        "latency_p50": float(np.percentile(latencies, 50)),
        "latency_p95": float(np.percentile(latencies, 95)),
        "latencies": latencies,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Test Classes
# ═══════════════════════════════════════════════════════════════════════════════

class TestPrecision:
    def test_precision_at_k(self, eval_metrics):
        p = eval_metrics["precision"]
        assert p >= 0.70, f"Precision@{K} = {p:.4f}, target >= 0.70"


class TestRecall:
    def test_recall_at_k(self, eval_metrics):
        r = eval_metrics["recall"]
        assert r >= 0.50, f"Recall@{K} = {r:.4f}, target >= 0.50"


class TestF1Score:
    def test_f1_score(self, eval_metrics):
        f1 = eval_metrics["f1"]
        assert f1 >= 0.60, f"F1-Score = {f1:.4f}, target >= 0.60"


class TestAvgCosine:
    def test_avg_cosine_score(self, eval_metrics):
        c = eval_metrics["avg_cosine"]
        assert c >= 0.30, f"Avg Cosine = {c:.4f}, target >= 0.30"


class TestSPIAccuracy:
    def test_spi_accuracy(self, eval_metrics):
        acc = eval_metrics["spi_accuracy"]
        assert acc >= 0.90, f"SPI Accuracy = {acc:.2%}, target >= 90%"


class TestEvalLatency:
    def test_latency_p50(self, eval_metrics):
        assert eval_metrics["latency_p50"] < 300

    def test_latency_p95(self, eval_metrics):
        assert eval_metrics["latency_p95"] < 500


# ═══════════════════════════════════════════════════════════════════════════════
# Laporan Evaluasi
# ═══════════════════════════════════════════════════════════════════════════════

class TestSummaryReport:
    def test_print_summary(self, eval_metrics):
        m = eval_metrics

        def _status(ok: bool) -> str:
            return "PASS" if ok else "FAIL"

        print(f"\n")
        print(f"{'='*58}")
        print(f"         LAPORAN EVALUASI MODEL AI NirSisa")
        print(f"{'='*58}")
        print(f"  Konfigurasi:")
        print(f"    Query sintetis   : {len(QUERIES)}")
        print(f"    Top-K            : {K}")
        print(f"    Retrieval pool   : Top-{N}")
        print(f"    Relevance        : >= {RELEVANCE_THRESHOLD:.0%} bahan cocok")
        print(f"    SPI skenario     : {len(SPI_SCENARIOS)}")
        print(f"{'='*58}")
        print(f"  {'Metrik':<24} {'Hasil':>8}  {'Target':>10}  {'Status':>6}")
        print(f"  {'-'*52}")
        print(f"  {'Precision@'+str(K):<24} {m['precision']:>8.4f}  {'>=0.70':>10}  {_status(m['precision']>=0.70):>6}")
        print(f"  {'Recall@'+str(K):<24} {m['recall']:>8.4f}  {'>=0.50':>10}  {_status(m['recall']>=0.50):>6}")
        print(f"  {'F1-Score':<24} {m['f1']:>8.4f}  {'>=0.60':>10}  {_status(m['f1']>=0.60):>6}")
        print(f"  {'Avg Cosine Score':<24} {m['avg_cosine']:>8.4f}  {'>=0.30':>10}  {_status(m['avg_cosine']>=0.30):>6}")
        print(f"  {'SPI Accuracy':<24} {m['spi_accuracy']:>7.2%}  {'>=90%':>10}  {_status(m['spi_accuracy']>=0.90):>6}")
        print(f"  {'Latency p50':<24} {m['latency_p50']:>6.0f}ms  {'<300ms':>10}  {_status(m['latency_p50']<300):>6}")
        print(f"  {'Latency p95':<24} {m['latency_p95']:>6.0f}ms  {'<500ms':>10}  {_status(m['latency_p95']<500):>6}")
        print(f"{'='*58}")

        assert True  # always pass — informational
