"""
NirSisa Load Testing — Locust
==============================
Cara pakai:
  1. Install: pip install locust
  2. Isi TOKEN di bawah (ambil dari app: login → copy access_token dari Supabase)
     ATAU set env variable:  export NIRSISA_TOKEN="eyJ..."
  3. Jalankan: locust -f locustfile.py
  4. Buka browser: http://localhost:8089
  5. Set jumlah user & spawn rate → Start

Cara dapat token:
  - Buka app → DevTools / Metro logs → cari "access_token"
  - ATAU login via curl:
      curl -X POST "https://<project>.supabase.co/auth/v1/token?grant_type=password" \
        -H "apikey: <anon_key>" \
        -H "Content-Type: application/json" \
        -d '{"email":"email@kamu.com","password":"passwordkamu"}'
"""

import os
from locust import HttpUser, task, between, tag

# ── Konfigurasi ──────────────────────────────────────────────────────────────
HOST = "https://nirsisa-production.up.railway.app"
TOKEN = os.getenv("NIRSISA_TOKEN", "GANTI_DENGAN_TOKEN_KAMU")
# ─────────────────────────────────────────────────────────────────────────────


class NirSisaUser(HttpUser):
    host = HOST
    wait_time = between(1, 3)  # jeda antar request: 1-3 detik

    def on_start(self):
        self.headers = {"Authorization": f"Bearer {TOKEN}"}

    # ── Endpoint paling berat: ML inference + SPI scoring ──
    @task(5)
    @tag("recommend")
    def get_recommendations(self):
        self.client.get(
            "/recommend",
            params={"top_k": 20},
            headers=self.headers,
            name="/recommend",
        )

    # ── Inventory list ──
    @task(3)
    @tag("inventory")
    def get_inventory(self):
        self.client.get(
            "/inventory",
            headers=self.headers,
            name="/inventory",
        )

    # ── Resep populer (fallback) ──
    @task(2)
    @tag("recipes")
    def get_popular_recipes(self):
        self.client.get(
            "/recipes/popular",
            params={"limit": 10},
            headers=self.headers,
            name="/recipes/popular",
        )

    # ── Search resep ──
    @task(2)
    @tag("recipes")
    def search_recipes(self):
        for q in ["ayam", "tempe", "tahu", "nasi"]:
            self.client.get(
                "/recipes",
                params={"search": q, "limit": 20},
                headers=self.headers,
                name="/recipes?search=",
            )

    # ── Health check ──
    @task(1)
    @tag("health")
    def health_check(self):
        self.client.get("/health", name="/health")


class HeavyUser(HttpUser):
    """Simulasi user yang spam endpoint /recommend (worst case)."""
    host = HOST
    wait_time = between(0.5, 1)
    weight = 1  # proporsi lebih kecil dari NirSisaUser

    def on_start(self):
        self.headers = {"Authorization": f"Bearer {TOKEN}"}

    @task
    def spam_recommend(self):
        self.client.get(
            "/recommend",
            params={"top_k": 20},
            headers=self.headers,
            name="/recommend [heavy]",
        )
