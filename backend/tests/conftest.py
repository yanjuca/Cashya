import os
from pathlib import Path
from uuid import uuid4

TEST_DB = Path(__file__).parent / "test_cashya.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-with-at-least-32-characters"
os.environ["AUTH_RATE_LIMIT_ATTEMPTS"] = "1000"

import pytest
from fastapi.testclient import TestClient

from app.main import app

API = "/api/v1"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, email: str | None = None, name: str = "Test User", password: str = "password123") -> dict:
    response = client.post(f"{API}/auth/register", json={"email": email or f"test-{uuid4()}@example.com", "name": name, "password": password})
    assert response.status_code == 201, response.text
    return response.json()["data"]


def bearer(auth: dict) -> dict:
    return {"Authorization": f"Bearer {auth['accessToken']}"}


@pytest.fixture
def account(client):
    return register(client)


@pytest.fixture
def auth_headers(account):
    return bearer(account)
