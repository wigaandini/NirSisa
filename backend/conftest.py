import os
import pytest
from dotenv import load_dotenv

load_dotenv()

# Deteksi ketersediaan model .pkl
_APP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
MODEL_AVAILABLE = (
    os.path.exists(os.path.join(_APP_DIR, "ml_models", "tfidf_vectorizer.pkl"))
    and os.path.exists(os.path.join(_APP_DIR, "ml_models", "recipe_matrix.pkl"))
    and os.path.exists(os.path.join(_APP_DIR, "data", "recipe_data.pkl"))
)


def pytest_collection_modifyitems(config, items):
    if MODEL_AVAILABLE:
        return
    skip = pytest.mark.skip(reason="Model .pkl tidak ditemukan")
    for item in items:
        if "requires_model" in item.keywords:
            item.add_marker(skip)