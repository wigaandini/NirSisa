"""
Load Test 5/7/10 User — NirSisa
=================================
Jalankan masing-masing skenario:

  python3 -m locust -f locust_loadtest.py --headless \
    --users 5 --spawn-rate 1 --run-time 5m \
    --csv=results_5u

  python3 -m locust -f locust_loadtest.py --headless \
    --users 7 --spawn-rate 1 --run-time 5m \
    --csv=results_7u

  python3 -m locust -f locust_loadtest.py --headless \
    --users 10 --spawn-rate 1 --run-time 5m \
    --csv=results_10u

Atau jalankan script run_loadtest.sh untuk ketiga skenario sekaligus.
"""

import os
from locust import HttpUser, task, between

HOST  = "https://nirsisa-production.up.railway.app"
TOKEN = os.getenv("NIRSISA_TOKEN", "GANTI_TOKEN")


class RecommendUser(HttpUser):
    host = HOST
    wait_time = between(2, 5)

    def on_start(self):
        self.headers = {"Authorization": f"Bearer {TOKEN}"}

    @task(5)
    def get_recommendations(self):
        self.client.get(
            "/recommend",
            params={"top_k": 20},
            headers=self.headers,
            name="/recommend",
        )

    @task(2)
    def get_inventory(self):
        self.client.get(
            "/inventory",
            headers=self.headers,
            name="/inventory",
        )

    @task(1)
    def get_popular(self):
        self.client.get(
            "/recipes/popular",
            params={"limit": 10},
            headers=self.headers,
            name="/recipes/popular",
        )
