import hashlib
import hmac
import json
import time
from uuid import uuid4

import pytest

from app.core import hardening
from app.core.config import settings
from app.core.hardening import RequestSignatureVerifier, SlidingWindowLimiter, parse_version
from tests.conftest import API

SECRET = "shared-with-the-mobile-app-at-least-32-chars"


def sign(method: str, path: str, body: bytes = b"", secret: str = SECRET, timestamp: int | None = None, nonce: str | None = None) -> dict:
    timestamp = timestamp or int(time.time())
    nonce = nonce or uuid4().hex
    canonical = "\n".join((method.upper(), path, str(timestamp), nonce, hashlib.sha256(body).hexdigest())).encode()
    signature = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    return {"X-Cashya-Signature": signature, "X-Cashya-Timestamp": str(timestamp), "X-Cashya-Nonce": nonce}


@pytest.fixture
def signing_enabled(monkeypatch):
    verifier = RequestSignatureVerifier(SECRET, max_skew_seconds=300)
    monkeypatch.setattr(hardening, "signature_verifier", verifier)
    monkeypatch.setattr("app.main.signature_verifier", verifier)
    return verifier


def test_security_headers_and_hidden_fingerprint(client):
    response = client.get(f"{API}/health")
    assert response.status_code == 200
    assert response.headers["server"] == "cashya"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert response.headers["cache-control"] == "no-store"
    assert "default-src 'none'" in response.headers["content-security-policy"]


def test_signed_requests_are_required_when_signing_is_enabled(client, auth_headers, signing_enabled):
    path = f"{API}/cards"
    unsigned = client.get(path, headers=auth_headers)
    assert unsigned.status_code == 401
    assert unsigned.json()["error"]["code"] == "INVALID_SIGNATURE"

    signed = client.get(path, headers={**auth_headers, **sign("GET", path)})
    assert signed.status_code == 200

    body = json.dumps({"holderName": "X", "lastDigits": "1", "expiryDate": "01/30", "limit": 10}).encode()
    created = client.post(path, content=body, headers={**auth_headers, **sign("POST", path, body), "Content-Type": "application/json"})
    assert created.status_code == 201, created.text

    tampered = client.post(path, content=body.replace(b"10", b"99"), headers={**auth_headers, **sign("POST", path, body), "Content-Type": "application/json"})
    assert tampered.status_code == 401

    wrong_secret = client.get(path, headers={**auth_headers, **sign("GET", path, secret="another-secret-that-is-long-enough-too")})
    assert wrong_secret.status_code == 401

    # Health stays reachable for load balancers, even without a signature.
    assert client.get(f"{API}/health").status_code == 200


def test_replayed_and_stale_signatures_are_rejected(client, auth_headers, signing_enabled):
    path = f"{API}/cards"
    headers = {**auth_headers, **sign("GET", path)}
    assert client.get(path, headers=headers).status_code == 200
    replay = client.get(path, headers=headers)
    assert replay.status_code == 401

    stale = client.get(path, headers={**auth_headers, **sign("GET", path, timestamp=int(time.time()) - 3600)})
    assert stale.status_code == 401


def test_minimum_client_version_is_enforced(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "min_client_version", "1.2.0")
    missing = client.get(f"{API}/cards", headers=auth_headers)
    assert missing.status_code == 426
    assert missing.json()["error"]["code"] == "UPGRADE_REQUIRED"
    assert client.get(f"{API}/cards", headers={**auth_headers, "X-Client-Version": "1.1.9"}).status_code == 426
    assert client.get(f"{API}/cards", headers={**auth_headers, "X-Client-Version": "1.2.0"}).status_code == 200
    assert client.get(f"{API}/cards", headers={**auth_headers, "X-Client-Version": "2.0.0-beta"}).status_code == 200


def test_global_rate_limit_applies_to_every_api_route(client, auth_headers, monkeypatch):
    limiter = SlidingWindowLimiter(limit=3, window_seconds=60)
    monkeypatch.setattr("app.main.global_rate_limiter", limiter)
    for _ in range(3):
        assert client.get(f"{API}/cards", headers=auth_headers).status_code == 200
    blocked = client.get(f"{API}/cards", headers=auth_headers)
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"]
    assert client.get(f"{API}/health").status_code == 200


def test_unknown_email_and_wrong_password_give_the_same_answer(client):
    unknown = client.post(f"{API}/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    from tests.conftest import register

    register(client, email="known@example.com")
    wrong = client.post(f"{API}/auth/login", json={"email": "known@example.com", "password": "wrong-pass1"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_unhandled_errors_do_not_leak_details(client, monkeypatch):
    from app.main import app

    @app.get("/api/v1/__boom")
    def boom():
        raise RuntimeError("secret database path /srv/cashya.db")

    from fastapi.testclient import TestClient

    with TestClient(app, raise_server_exceptions=False) as raw_client:
        response = raw_client.get("/api/v1/__boom")
    assert response.status_code == 500
    assert response.json() == {"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error", "details": []}}
    assert "cashya.db" not in response.text


def test_parse_version():
    assert parse_version("1.2.3") == (1, 2, 3)
    assert parse_version("2.0.0-beta.1") == (2, 0, 0)
    assert parse_version("garbage") == (0,)
    assert parse_version("1.10") > parse_version("1.9.9")
