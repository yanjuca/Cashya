import time

from starlette.requests import Request
from starlette.responses import Response

from app.core import hardening
from app.core.config import settings
from app.core.hardening import (
    CLIENT_VERSION_HEADER,
    NONCE_HEADER,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    NonceCache,
    RequestSignatureVerifier,
    SlidingWindowLimiter,
    apply_security_headers,
    client_ip,
    client_version_allowed,
    parse_version,
)


def _request(method="GET", path="/api/v1/cards", headers=None, client=("127.0.0.1", 12345)):
    raw_headers = [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()]
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": raw_headers,
        "server": ("testserver", 80),
        "client": client,
    }
    return Request(scope)


def test_sliding_window_limiter_allows_requests_up_to_limit(monkeypatch):
    clock = iter([10.0, 11.0, 12.0])
    monkeypatch.setattr(hardening.time, "monotonic", lambda: next(clock))
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    assert limiter.allowed("ip") == (True, 0)
    assert limiter.allowed("ip") == (True, 0)
    allowed, retry_after = limiter.allowed("ip")
    assert allowed is False
    assert retry_after >= 1


def test_sliding_window_limiter_expires_old_attempts(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(hardening.time, "monotonic", lambda: now[0])
    limiter = SlidingWindowLimiter(limit=1, window_seconds=10)
    assert limiter.allowed("ip")[0] is True
    assert limiter.allowed("ip")[0] is False
    now[0] = 10.0
    assert limiter.allowed("ip") == (True, 0)


def test_sliding_window_limiter_can_be_disabled():
    limiter = SlidingWindowLimiter(limit=0, window_seconds=60)
    assert limiter.enabled is False
    assert limiter.allowed("any-ip") == (True, 0)


def test_nonce_cache_rejects_replay_and_accepts_new_nonce():
    cache = NonceCache(ttl_seconds=60)
    assert cache.register("nonce-123456789012") is True
    assert cache.register("nonce-123456789012") is False
    assert cache.register("nonce-abcdefghijkl") is True


def test_nonce_cache_expires_old_nonce(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(hardening.time, "time", lambda: now[0])
    cache = NonceCache(ttl_seconds=5)
    assert cache.register("nonce-123456789012") is True
    now[0] = 106.0
    assert cache.register("nonce-123456789012") is True


def test_signature_verifier_accepts_valid_signature():
    verifier = RequestSignatureVerifier("a sufficiently long shared secret", max_skew_seconds=300)
    timestamp = str(int(time.time()))
    nonce = "nonce-1234567890123456"
    body = b'{"amount":10}'
    signature = verifier.sign("POST", "/api/v1/expenses", timestamp, nonce, body)
    request = _request(
        method="POST",
        path="/api/v1/expenses",
        headers={SIGNATURE_HEADER: signature, TIMESTAMP_HEADER: timestamp, NONCE_HEADER: nonce},
    )
    assert verifier.verify(request, body) is None


def test_signature_verifier_rejects_missing_headers():
    verifier = RequestSignatureVerifier("secret", max_skew_seconds=300)
    assert verifier.verify(_request(), b"") == "missing signature headers"


def test_signature_verifier_rejects_non_numeric_timestamp():
    verifier = RequestSignatureVerifier("secret", max_skew_seconds=300)
    request = _request(headers={SIGNATURE_HEADER: "abc", TIMESTAMP_HEADER: "today", NONCE_HEADER: "nonce-123456789012"})
    assert verifier.verify(request, b"") == "invalid timestamp"


def test_signature_verifier_rejects_stale_timestamp():
    verifier = RequestSignatureVerifier("secret", max_skew_seconds=10)
    timestamp = str(int(time.time()) - 100)
    request = _request(headers={SIGNATURE_HEADER: "abc", TIMESTAMP_HEADER: timestamp, NONCE_HEADER: "nonce-123456789012"})
    assert verifier.verify(request, b"") == "timestamp outside the allowed window"


def test_signature_verifier_rejects_short_nonce():
    verifier = RequestSignatureVerifier("secret", max_skew_seconds=300)
    timestamp = str(int(time.time()))
    request = _request(headers={SIGNATURE_HEADER: "abc", TIMESTAMP_HEADER: timestamp, NONCE_HEADER: "short"})
    assert verifier.verify(request, b"") == "invalid nonce"


def test_signature_verifier_rejects_wrong_signature():
    verifier = RequestSignatureVerifier("secret", max_skew_seconds=300)
    timestamp = str(int(time.time()))
    request = _request(headers={SIGNATURE_HEADER: "incorrect", TIMESTAMP_HEADER: timestamp, NONCE_HEADER: "nonce-123456789012"})
    assert verifier.verify(request, b"") == "invalid signature"


def test_signature_verifier_rejects_replayed_valid_request():
    verifier = RequestSignatureVerifier("secret", max_skew_seconds=300)
    timestamp = str(int(time.time()))
    nonce = "nonce-123456789012"
    signature = verifier.sign("GET", "/api/v1/cards", timestamp, nonce, b"")
    request = _request(headers={SIGNATURE_HEADER: signature, TIMESTAMP_HEADER: timestamp, NONCE_HEADER: nonce})
    assert verifier.verify(request, b"") is None
    assert verifier.verify(request, b"") == "replayed request"


def test_client_ip_uses_forwarded_header_only_when_proxy_is_trusted(monkeypatch):
    request = _request(headers={"X-Forwarded-For": "203.0.113.5, 10.0.0.1"})
    monkeypatch.setattr(settings, "trust_proxy_headers", False)
    assert client_ip(request) == "127.0.0.1"
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    assert client_ip(request) == "203.0.113.5"


def test_client_ip_returns_unknown_without_client(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", False)
    request = _request(client=None)
    assert client_ip(request) == "unknown"


def test_parse_version_handles_numeric_and_prerelease_segments():
    assert parse_version("1.2.3") == (1, 2, 3)
    assert parse_version("2.0.0-beta.1") == (2, 0, 0)
    assert parse_version("1.10") > parse_version("1.9.9")
    assert parse_version("not-a-version") == (0,)


def test_client_version_allowed_respects_minimum_version(monkeypatch):
    monkeypatch.setattr(settings, "min_client_version", "1.2.0")
    assert client_version_allowed(_request(headers={})) is False
    assert client_version_allowed(_request(headers={CLIENT_VERSION_HEADER: "1.1.9"})) is False
    assert client_version_allowed(_request(headers={CLIENT_VERSION_HEADER: "1.2.0"})) is True
    assert client_version_allowed(_request(headers={CLIENT_VERSION_HEADER: "2.0.0-beta"})) is True


def test_client_version_allowed_when_no_minimum_is_configured(monkeypatch):
    monkeypatch.setattr(settings, "min_client_version", "")
    assert client_version_allowed(_request(headers={})) is True


def test_apply_security_headers_sets_api_headers(monkeypatch):
    monkeypatch.setattr(settings, "hsts_enabled", False)
    request = _request(path="/api/v1/cards")
    response = Response()
    apply_security_headers(request, response)
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Server"] == "cashya"


def test_apply_security_headers_adds_hsts_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "hsts_enabled", True)
    response = Response()
    apply_security_headers(_request(path="/api/v1/health"), response)
    assert response.headers["Strict-Transport-Security"] == "max-age=63072000; includeSubDomains"
