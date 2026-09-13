from collections.abc import Generator
from pathlib import Path

import pytest
from app.core.database import reset_database_state
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    data_dir = Path(__file__).resolve().parents[1] / "data"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'app.db'}")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("DEMO_SEED", "true")
    monkeypatch.setenv("DEMO_REPLAY_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    reset_database_state()
    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
    reset_database_state()
