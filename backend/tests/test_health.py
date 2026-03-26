import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "NirSisa" in r.json()["status"]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"
    assert r.json()["database"] == "connected"


def test_inventory_requires_auth(client):
    r = client.get("/inventory")
    assert r.status_code in (401, 403)  # no JWT token


def test_recipes_requires_auth(client):
    r = client.get("/recipes")
    assert r.status_code in (401, 403)


def test_recommend_requires_auth(client):
    r = client.get("/recommend")
    assert r.status_code in (401, 403)


def test_legacy_recommend_no_auth(client):
    # Legacy POST /recommend harus tetap jalan tanpa auth 
    response = client.post("/recommend", json={
        "ingredients": [
            {"name": "bayam", "days_left": 1},
            {"name": "ayam", "days_left": 5},
        ]
    })
    assert response.status_code == 200
    data = response.json()
    assert "query_cleaned" in data
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0
    # Resep harus punya field dari versi teman
    rec = data["recommendations"][0]
    assert "title" in rec
    assert "score" in rec
    assert "similarity_component" in rec
    assert "spi_component" in rec


def test_health_ai_engine(client):
    # Health endpoint harus juga report status AI engine 
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert "ai_engine_loaded" in data
    assert "total_recipes" in data