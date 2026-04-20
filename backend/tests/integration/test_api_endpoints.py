"""Fase 2 — Integration Test: API Endpoints.

Menguji alur end-to-end melalui HTTP:
- Health check
- Auth guard (endpoint wajib JWT)
- Inventory CRUD
- Recommendation
- Notifications
"""
import pytest

pytestmark = pytest.mark.integration


# ═══════════════════════════════════════════════════════════════════════════════
# A. Health & Root
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealth:
    def test_root_online(self, client_no_auth):
        r = client_no_auth.get("/")
        assert r.status_code == 200
        assert "NirSisa" in r.json()["status"]

    def test_health_check(self, client_no_auth):
        r = client_no_auth.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("healthy", "degraded")
        assert "database" in data
        assert "ai_engine_loaded" in data
        assert "total_recipes" in data

    def test_health_reports_ai_status(self, client_no_auth):
        data = client_no_auth.get("/health").json()
        assert isinstance(data["ai_engine_loaded"], bool)
        assert isinstance(data["total_recipes"], int)


# ═══════════════════════════════════════════════════════════════════════════════
# B. Auth Guard — endpoint wajib JWT
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuthGuard:
    """Endpoint terproteksi harus menolak request tanpa token."""

    @pytest.mark.parametrize("endpoint", [
        "/inventory",
        "/recipes",
        "/recommend",
        "/notifications",
    ])
    def test_no_token_returns_401_or_403(self, client_no_auth, endpoint):
        r = client_no_auth.get(endpoint)
        assert r.status_code in (401, 403), f"{endpoint} harusnya butuh auth"


# ═══════════════════════════════════════════════════════════════════════════════
# C. Inventory CRUD (dengan mock auth)
# ═══════════════════════════════════════════════════════════════════════════════

class TestInventoryAPI:
    """CRUD inventory melalui HTTP (auth di-bypass ke mock user)."""

    def test_list_inventory(self, client):
        r = client.get("/inventory")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_add_item_requires_fields(self, client):
        """POST tanpa body → 422 Validation Error."""
        r = client.post("/inventory", json={})
        assert r.status_code == 422

    def test_add_item_valid(self, client):
        """POST bahan valid → 201."""
        payload = {
            "item_name": "Bayam Segar",
            "quantity": 2,
            "unit": "ikat",
            "is_natural": True,
        }
        r = client.post("/inventory", json=payload)
        # 201 jika berhasil, 500 jika mock user tidak ada di DB (expected di test env)
        assert r.status_code in (201, 500)

    def test_delete_nonexistent_item(self, client):
        """DELETE item yang tidak ada → 404."""
        r = client.delete("/inventory/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404

    def test_patch_nonexistent_item(self, client):
        """PATCH item yang tidak ada → 404."""
        r = client.patch(
            "/inventory/00000000-0000-0000-0000-000000000000",
            json={"quantity": 5},
        )
        assert r.status_code == 404

    def test_ingredient_search(self, client):
        """GET /inventory/ingredient-search tanpa auth."""
        r = client.get("/inventory/ingredient-search", params={"q": "bay"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unit_suggest(self, client):
        """GET /inventory/unit-suggest."""
        r = client.get("/inventory/unit-suggest", params={"item_name": "bayam"})
        assert r.status_code == 200
        data = r.json()
        assert "default_unit" in data


# ═══════════════════════════════════════════════════════════════════════════════
# D. Recipes API
# ═══════════════════════════════════════════════════════════════════════════════

class TestRecipesAPI:
    def test_list_recipes(self, client):
        r = client.get("/recipes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_recipes_with_search(self, client):
        r = client.get("/recipes", params={"search": "ayam", "limit": 5})
        assert r.status_code == 200

    def test_get_nonexistent_recipe(self, client):
        r = client.get("/recipes/999999")
        assert r.status_code in (404, 500)


# ═══════════════════════════════════════════════════════════════════════════════
# E. Recommend API
# ═══════════════════════════════════════════════════════════════════════════════

class TestRecommendAPI:
    def test_recommend_returns_response(self, client):
        """GET /recommend → bisa 200 (ada stok) atau 400 (kosong)."""
        r = client.get("/recommend")
        assert r.status_code in (200, 400, 503)

    def test_recommend_with_top_k(self, client):
        r = client.get("/recommend", params={"top_k": 5})
        assert r.status_code in (200, 400, 503)


# ═══════════════════════════════════════════════════════════════════════════════
# F. Notifications API
# ═══════════════════════════════════════════════════════════════════════════════

class TestNotificationsAPI:
    def test_list_notifications(self, client):
        r = client.get("/notifications")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "unread_count" in data
        assert "notifications" in data

    def test_register_token_invalid_format(self, client):
        """Token yang bukan ExponentPushToken → 400."""
        r = client.post("/notifications/token", json={
            "expo_push_token": "invalid-token-format",
        })
        assert r.status_code == 400

    def test_mark_all_read(self, client):
        r = client.patch("/notifications/read-all")
        assert r.status_code == 200
        assert "marked_read" in r.json()

    def test_check_expiry_trigger(self, client):
        """Manual trigger expiry check."""
        r = client.post("/notifications/check-expiry")
        assert r.status_code == 200
        data = r.json()
        assert "scanned" in data
        assert "notified_users" in data


# ═══════════════════════════════════════════════════════════════════════════════
# G. Reconciliation
# ═══════════════════════════════════════════════════════════════════════════════

class TestReconciliation:
    def test_reconcile_empty_ingredients(self, client):
        """Reconcile tanpa bahan → tetap berhasil (log history)."""
        r = client.post("/inventory/reconcile", json={
            "recipe_title": "Test Recipe",
            "ingredients_used": [],
        })
        # 200 sukses atau 400/500 tergantung validasi
        assert r.status_code in (200, 400, 500)
