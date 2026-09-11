import os
from pathlib import Path
from uuid import uuid4

TEST_DB = Path(__file__).parent / "test_cashya.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-with-at-least-32-characters"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(client):
    response = client.post("/auth/register", json={"email": f"test-{uuid4()}@example.com", "name": "Test User", "password": "password123"})
    token = response.json()["data"]["token"]
    return {"Authorization": f"Bearer {token}"}
