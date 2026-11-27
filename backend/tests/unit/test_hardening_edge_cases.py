from collections import defaultdict, deque

from starlette.responses import Response

from app.core import hardening
from app.core.config import settings
from app.core.hardening import RequestSignatureVerifier, SlidingWindowLimiter, apply_security_headers, client_ip
from starlette.requests import Request


def make_request(path="/api/v1/cards", headers=None, client=("127.0.0.1", 12345)):
    raw_headers = [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()]
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": raw_headers,
        "server": ("testserver", 80),
        "client": client,
    }
    return Request(scope)


def test_limiter_evicts_idle_keys_when_cache_exceeds_limit(monkeypatch):
    limiter = SlidingWindowLimiter(limit=1, window_seconds=10)
    limiter.attempts = defaultdict(
        deque,
        {f"old-{index}": deque([0.0]) for index in range(10_001)},
    )
    monkeypatch.setattr(hardening.time, "monotonic", lambda: 20.0)

    assert limiter.allowed("new-key") == (True, 0)
    assert list(limiter.attempts) == ["new-key"]


def test_signature_verifier_enabled_depends_on_configured_secret():
    assert RequestSignatureVerifier("", max_skew_seconds=60).enabled is False
    assert RequestSignatureVerifier("secret", max_skew_seconds=60).enabled is True


def test_client_ip_uses_socket_when_trusted_forwarded_header_is_empty(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    request = make_request(headers={"X-Forwarded-For": ""})
    assert client_ip(request) == "127.0.0.1"


def test_security_headers_use_no_cache_outside_api_prefix(monkeypatch):
    monkeypatch.setattr(settings, "hsts_enabled", False)
    response = Response()

    apply_security_headers(make_request(path="/health"), response)

    assert response.headers["Cache-Control"] == "no-cache"
    assert "Content-Security-Policy" not in response.headers
