import pytest
from fastapi.testclient import TestClient

MOCK_USER_ID = "40a569fa-6bf2-4672-8ffc-3d80b062f535"


# Knowledge Base (untuk tes AI) 

@pytest.fixture(scope="session")
def knowledge_base():
    """Load RecipeKnowledgeBase sekali untuk seluruh session."""
    from conftest import MODEL_AVAILABLE
    if not MODEL_AVAILABLE:
        pytest.skip("Model .pkl tidak tersedia")

    from app.ai.cbf import RecipeKnowledgeBase
    kb = RecipeKnowledgeBase.get_instance()
    if not kb.is_loaded:
        kb.load()
    return kb


# FastAPI Test Client (untuk tes integrasi) 

@pytest.fixture(scope="module")
def client():
    """TestClient dengan auth di-bypass ke MOCK_USER_ID."""
    from app.main import app
    from app.core.auth import get_current_user_id

    async def _mock_user():
        return MOCK_USER_ID

    app.dependency_overrides[get_current_user_id] = _mock_user
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="module")
def client_no_auth():
    """TestClient tanpa auth override (untuk tes guard)."""
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c