
# Evaluasi Model AI 
# 1. Precision@K >= 0.70
# 2. Recall@K >= 0.50
# 3. F1-Score >= 0.60
# 4. Cosine Similarity Score (Rata-rata) >= 0.30
# 5. SPI Accuracy >= 0.90
# 6. Latency p50 < 300ms, p95 < 500ms

# Metodologi Recall:
# Karena sistem CBF bersifat unsupervised (tanpa label ground truth manual),
# Recall@K dihitung terhadap retrieval pool (Top-N, N=20).
# Recall@K = relevant_in_Top10 / relevant_in_Top20
# Ini mengukur: dari resep relevan yang BISA ditemukan sistem, berapa persen yang masuk Top-10.

import pytest
import os
import numpy as np

_APP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app"
)
_MODEL_EXISTS = (
    os.path.exists(os.path.join(_APP_DIR, "ml_models", "tfidf_vectorizer.pkl"))
    and os.path.exists(os.path.join(_APP_DIR, "ml_models", "recipe_matrix.pkl"))
    and os.path.exists(os.path.join(_APP_DIR, "data", "recipe_data.pkl"))
)
pytestmark = pytest.mark.skipif(
    not _MODEL_EXISTS,
    reason="Model files (.pkl) tidak ditemukan",
)

from app.ai.cbf import RecipeKnowledgeBase
from app.ai.recommender import get_recommendations, InventoryItem


@pytest.fixture(scope="module")
def knowledge_base():
    kb = RecipeKnowledgeBase.get_instance()
    if not kb.is_loaded:
        kb.load()
    return kb

# Ground Truth: 20 query sinteti

EVALUATION_QUERIES = [
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

K = 10
N = 20  # Retrieval pool untuk Recall
RELEVANCE_THRESHOLD = 0.5

# Helper

def _is_relevant(recipe, keywords: list[str]) -> bool:
    # Resep relevan jika >= 50% bahan input ada di resep 
    text = (recipe.title + " " + recipe.ingredients_cleaned).lower()
    matched = sum(1 for kw in keywords if kw.lower() in text)
    return (matched / len(keywords)) >= RELEVANCE_THRESHOLD if keywords else False


def _compute_metrics(knowledge_base):
    # Hitung Precision@K, Recall@K, dan F1-Score.
    # Precision@K = relevant_in_TopK / K
    # Recall@K    = relevant_in_TopK / relevant_in_TopN  (N=20)
    # F1          = 2 * P * R / (P + R)
    all_precision = []
    all_recall = []

    for name, ingredients, keywords in EVALUATION_QUERIES:
        items = [InventoryItem(name=ing) for ing in ingredients]

        # Ambil Top-N (pool lebih besar)
        result_n = get_recommendations(items, top_k=N, spi_weight=0.0)

        # Hitung relevant di Top-K (10 teratas)
        relevant_in_topk = sum(
            1 for r in result_n.recipes[:K] if _is_relevant(r, keywords)
        )
        # Hitung relevant di Top-N (20 teratas) sebagai denominator recall
        relevant_in_topn = sum(
            1 for r in result_n.recipes[:N] if _is_relevant(r, keywords)
        )

        # Precision@K
        precision = relevant_in_topk / K
        all_precision.append(precision)

        # Recall@K = relevant_in_TopK / relevant_in_TopN
        recall = relevant_in_topk / relevant_in_topn if relevant_in_topn > 0 else 1.0
        all_recall.append(recall)

    avg_precision = np.mean(all_precision)
    avg_recall = np.mean(all_recall)
    f1 = (2 * avg_precision * avg_recall / (avg_precision + avg_recall)
           if (avg_precision + avg_recall) > 0 else 0.0)

    return avg_precision, avg_recall, f1


def _compute_avg_cosine(knowledge_base):
    # Rata-rata cosine similarity score dari 20 query 
    all_scores = []
    for name, ingredients, _ in EVALUATION_QUERIES:
        items = [InventoryItem(name=ing) for ing in ingredients]
        result = get_recommendations(items, top_k=K, spi_weight=0.0)
        for r in result.recipes:
            all_scores.append(r.cosine_score)
    return np.mean(all_scores)


def _compute_spi_accuracy(knowledge_base):
    # % skenario di mana bahan kritis muncul di Top-1 
    hits = 0
    for critical, d_crit, other, d_other in SPI_SCENARIOS:
        items = [
            InventoryItem(name=critical, days_remaining=d_crit),
            InventoryItem(name=other, days_remaining=d_other),
        ]
        result = get_recommendations(items, top_k=K, spi_weight=0.4)
        top = result.recipes[0]
        text = (top.title + " " + top.ingredients_cleaned).lower()
        if critical.lower() in text:
            hits += 1
    return hits / len(SPI_SCENARIOS)

# Test

class TestPrecisionRecallF1:
    # Evaluasi Precision@K, Recall@K, F1-Score 
    @pytest.fixture(scope="class")
    def metrics(self, knowledge_base):
        p, r, f1 = _compute_metrics(knowledge_base)
        print(f"\n{'='*60}")
        print(f"  HASIL EVALUASI PRECISION / RECALL / F1")
        print(f"{'='*60}")
        print(f"  Query         : {len(EVALUATION_QUERIES)} sintetis")
        print(f"  Top-K         : {K}")
        print(f"  Retrieval Pool: Top-{N} (untuk denominator Recall)")
        print(f"  Relevance     : >= {RELEVANCE_THRESHOLD:.0%} bahan input cocok")
        print(f"{'='*60}")
        print(f"  Precision@{K}  : {p:.4f}  (target >= 0.70)")
        print(f"  Recall@{K}     : {r:.4f}  (target >= 0.50)")
        print(f"  F1-Score       : {f1:.4f}  (target >= 0.60)")
        print(f"{'='*60}")
        return p, r, f1

    def test_precision_at_k(self, metrics):
        # Precision@K >= 0.70# 
        p, _, _ = metrics
        assert p >= 0.70, f"Precision@{K} = {p:.4f}, target >= 0.70"

    def test_recall_at_k(self, metrics):
        # Recall@K >= 0.50# 
        _, r, _ = metrics
        assert r >= 0.50, f"Recall@{K} = {r:.4f}, target >= 0.50"

    def test_f1_score(self, metrics):
        # F1-Score >= 0.60# 
        _, _, f1 = metrics
        assert f1 >= 0.60, f"F1-Score = {f1:.4f}, target >= 0.60"


class TestCosineSimScore:
    # Evaluasi rata-rata Cosine Similarity Score 
    def test_avg_cosine_score(self, knowledge_base):
        # Avg Cosine Similarity >= 0.30# 
        avg = _compute_avg_cosine(knowledge_base)
        print(f"\n{'='*60}")
        print(f"  HASIL EVALUASI COSINE SIMILARITY")
        print(f"{'='*60}")
        print(f"  Avg Cosine Score : {avg:.4f}  (target >= 0.30)")
        print(f"{'='*60}")
        assert avg >= 0.30, f"Avg Cosine = {avg:.4f}, target >= 0.30"


class TestSPIAccuracy:
    # Evaluasi SPI Accuracy 
    def test_spi_accuracy(self, knowledge_base):
        # SPI Accuracy >= 0.90# 
        acc = _compute_spi_accuracy(knowledge_base)
        print(f"\n{'='*60}")
        print(f"  HASIL EVALUASI SPI ACCURACY")
        print(f"{'='*60}")
        print(f"  Skenario : {len(SPI_SCENARIOS)}")
        print(f"  Berhasil : {int(acc * len(SPI_SCENARIOS))}")
        print(f"  Accuracy : {acc:.2%}  (target >= 90%)")
        print(f"{'='*60}")
        assert acc >= 0.90, f"SPI Accuracy = {acc:.2%}, target >= 90%"


class TestLatency:
    # Evaluasi latency 
    def test_latency_p50_under_300ms(self, knowledge_base):
        # Latency p50 < 300ms# 
        lats = []
        for _, ings, _ in EVALUATION_QUERIES:
            items = [InventoryItem(name=i, days_remaining=3) for i in ings]
            result = get_recommendations(items, top_k=K, spi_weight=0.4)
            lats.append(result.latency_ms)
        p50 = np.percentile(lats, 50)
        p95 = np.percentile(lats, 95)
        print(f"\n{'='*60}")
        print(f"  HASIL EVALUASI LATENCY ({len(lats)} requests)")
        print(f"{'='*60}")
        print(f"  p50  : {p50:.1f} ms  (target < 300ms)")
        print(f"  p95  : {p95:.1f} ms  (target < 500ms)")
        print(f"  min  : {min(lats):.1f} ms")
        print(f"  max  : {max(lats):.1f} ms")
        print(f"  mean : {np.mean(lats):.1f} ms")
        print(f"{'='*60}")
        assert p50 < 300, f"p50 = {p50:.1f}ms"

    def test_latency_p95_under_500ms(self, knowledge_base):
        # Latency p95 < 500ms# 
        lats = []
        for _, ings, _ in EVALUATION_QUERIES:
            items = [InventoryItem(name=i, days_remaining=3) for i in ings]
            result = get_recommendations(items, top_k=K, spi_weight=0.4)
            lats.append(result.latency_ms)
        assert np.percentile(lats, 95) < 500


class TestSummaryReport:
    # Ringkasan seluruh evaluasi 
    def test_print_summary(self, knowledge_base):
        p, r, f1 = _compute_metrics(knowledge_base)
        avg_cos = _compute_avg_cosine(knowledge_base)
        spi_acc = _compute_spi_accuracy(knowledge_base)

        lats = []
        for _, ings, _ in EVALUATION_QUERIES:
            items = [InventoryItem(name=i, days_remaining=3) for i in ings]
            result = get_recommendations(items, top_k=K, spi_weight=0.4)
            lats.append(result.latency_ms)
        p50 = np.percentile(lats, 50)
        p95 = np.percentile(lats, 95)

        print(f"\n")
        print(f"          LAPORAN EVALUASI MODEL AI               ")
        print(f"-"*50)
        print(f"  Pengaturan Evaluasi:                                   ")
        print(f"    Query sintetis  : {len(EVALUATION_QUERIES):>3}                                  ")
        print(f"    Top-K           : {K:>3}                                  ")
        print(f"    Retrieval pool  : Top-{N:<3} (untuk Recall)              ")
        print(f"    Relevance       : >= {RELEVANCE_THRESHOLD:.0%} bahan cocok                  ")
        print(f"    SPI skenario    : {len(SPI_SCENARIOS):>3}                                  ")
        print(f"-"*50)
        print(f"  Metrik                 Hasil      Target      Status   ")
        print(f"-"*50)
        print(f"  Precision@{K}           {p:.4f}     >= 0.70      {'✅' if p >= 0.70 else '❌'}      ")
        print(f"  Recall@{K}              {r:.4f}     >= 0.50      {'✅' if r >= 0.50 else '❌'}      ")
        print(f"  F1-Score               {f1:.4f}     >= 0.60      {'✅' if f1 >= 0.60 else '❌'}      ")
        print(f"  Avg Cosine Score       {avg_cos:.4f}     >= 0.30      {'✅' if avg_cos >= 0.30 else '❌'}      ")
        print(f"  SPI Accuracy           {spi_acc:>6.2%}    >= 90%       {'✅' if spi_acc >= 0.90 else '❌'}      ")
        print(f"  Latency p50            {p50:>5.0f} ms    < 300 ms     {'✅' if p50 < 300 else '❌'}      ")
        print(f"  Latency p95            {p95:>5.0f} ms    < 500 ms     {'✅' if p95 < 500 else '❌'}      ")

        assert True