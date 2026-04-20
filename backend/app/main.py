# NirSisa Backend - Main Application
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.core.config import get_settings
from app.ai.cbf import RecipeKnowledgeBase
from app.ai.recommender import get_recommendations, InventoryItem, diagnose_kb

# Routers
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.recipes import router as recipes_router
from app.api.recommend import router as recommend_router
from app.api.notifications import router as notifications_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# --- SCHEDULER ---
_scheduler = None


def _start_scheduler():
    """Jalankan APScheduler untuk expiry check harian pukul 07:00 WIB (00:00 UTC)."""
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from app.tasks.expiry_checker import check_and_notify

        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.add_job(
            check_and_notify,
            trigger="cron",
            hour=0,
            minute=0,
            id="daily_expiry_check",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("Scheduler started: expiry check daily at 00:00 UTC (07:00 WIB)")
    except ImportError:
        logger.warning("apscheduler not installed — skipping scheduled expiry check. "
                       "Install with: pip install apscheduler")
    except Exception as e:
        logger.error("Failed to start scheduler: %s", e)


def _stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")
        _scheduler = None


# --- LIFESPAN (Startup & Shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== NirSisa Backend Starting ===")

    # Load AI Engine
    try:
        kb = RecipeKnowledgeBase.get_instance()
        kb.load()
        logger.info(f"AI Engine siap: {len(kb.df_recipes)} resep dimuat.")
        diag = diagnose_kb()
        logger.info("KB diagnostic: vocab_size=%s, matrix=%s, comma_sep=%s",
                     diag.get("vocab_size"), diag.get("matrix_shape"),
                     diag.get("is_comma_separated"))
        logger.info("KB vocab sample: %s", diag.get("vocab_sample_30", [])[:10])
        logger.info("KB token check: %s", diag.get("token_in_vocab"))
    except Exception as e:
        logger.error(f"GAGAL memuat AI Engine: {e}")

    # Start scheduler
    _start_scheduler()

    yield

    _stop_scheduler()
    logger.info("=== NirSisa Backend Shutting Down ===")


# --- APP FACTORY ---
def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="NirSisa API",
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Routers
    app.include_router(health_router)
    app.include_router(inventory_router)
    app.include_router(recipes_router)
    app.include_router(recommend_router)
    app.include_router(notifications_router)

    # --- DEBUG ENDPOINT ---
    @app.get("/debug/kb", tags=["Debug"])
    def debug_knowledge_base():
        return diagnose_kb()

    # --- LEGACY ENDPOINTS ---
    @app.get("/auth/callback", response_class=HTMLResponse, tags=["Auth"])
    def auth_callback(request: Request):
        app_redirect = request.query_params.get("app_redirect", "nirsisa://")
        html = f"""
        <!DOCTYPE html>
        <html>
        <head><title>NirSisa - Login Berhasil</title></head>
        <body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#FAFAFA;">
          <div style="text-align:center;padding:24px;">
            <h2 style="color:#2B2B2B;">Login Berhasil!</h2>
            <p style="color:#656C6E;">Mengarahkan ke aplikasi...</p>
            <a id="open" href="#" style="display:inline-block;margin-top:16px;padding:12px 32px;background:#BB0009;color:#fff;border-radius:24px;text-decoration:none;font-weight:bold;">Buka Aplikasi</a>
          </div>
          <script>
            var hash = window.location.hash;
            var appUrl = decodeURIComponent("{app_redirect}") + hash;
            document.getElementById('open').href = appUrl;
            setTimeout(function() {{ window.location.href = appUrl; }}, 500);
          </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html)

    @app.get("/", tags=["Legacy"])
    def read_root():
        return {
            "status": "NirSisa Backend is Online",
            "engine": "Modular AI Engine Active",
        }

    return app


app = create_app()
