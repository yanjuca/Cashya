
import hashlib
import hmac
import time
from collections import OrderedDict, defaultdict, deque
from threading import Lock

from fastapi import Request, Response

from app.core.config import settings

SIGNATURE_HEADER = "x-cashya-signature"
TIMESTAMP_HEADER = "x-cashya-timestamp"
NONCE_HEADER = "x-cashya-nonce"
CLIENT_VERSION_HEADER = "x-client-version"
SIGNED_HEADERS = (SIGNATURE_HEADER, TIMESTAMP_HEADER, NONCE_HEADER)


class SlidingWindowLimiter:
    """Sliding-window counter per key (usually the client IP). Single-process only; use Redis across replicas."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self.attempts: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    @property
    def enabled(self) -> bool:
        return self.limit > 0

    def allowed(self, key: str) -> tuple[bool, int]:
        if not self.enabled:
            return True, 0
        now = time.monotonic()
        with self.lock:
            timestamps = self.attempts[key]
            while timestamps and now - timestamps[0] >= self.window_seconds:
                timestamps.popleft()
            if len(timestamps) >= self.limit:
                return False, max(1, int(self.window_seconds - (now - timestamps[0])))
            timestamps.append(now)
            if len(self.attempts) > 10_000:
                self._evict_idle(now)
            return True, 0

    def _evict_idle(self, now: float) -> None:
        for key in [key for key, stamps in self.attempts.items() if not stamps or now - stamps[-1] >= self.window_seconds]:
            del self.attempts[key]


class NonceCache:
    """Remembers nonces seen inside the signature window so the same signed request cannot be sent twice."""

    def __init__(self, ttl_seconds: int, max_items: int = 50_000):
        self.ttl_seconds = ttl_seconds
        self.max_items = max_items
        self.seen: OrderedDict[str, float] = OrderedDict()
        self.lock = Lock()

    def register(self, nonce: str) -> bool:
        """Return True when the nonce is new; False when it was already used."""
        now = time.time()
        with self.lock:
            while self.seen and (now - next(iter(self.seen.values())) > self.ttl_seconds or len(self.seen) >= self.max_items):
                self.seen.popitem(last=False)
            if nonce in self.seen:
                return False
            self.seen[nonce] = now
            return True


class RequestSignatureVerifier:
    """HMAC-SHA256 over ``METHOD\\nPATH\\nTIMESTAMP\\nNONCE\\nSHA256(BODY)``.

    The mobile app computes the same digest with the shared ``REQUEST_SIGNING_SECRET`` (see ``signing.ts``).
    A leaked secret can be rotated at any time by changing the env var and shipping a new app build.
    """

    def __init__(self, secret: str, max_skew_seconds: int):
        self.secret = secret.encode("utf-8") if secret else b""
        self.max_skew_seconds = max_skew_seconds
        self.nonces = NonceCache(ttl_seconds=max_skew_seconds * 2)

    @property
    def enabled(self) -> bool:
        return bool(self.secret)

    @staticmethod
    def canonical(method: str, path: str, timestamp: str, nonce: str, body: bytes) -> bytes:
        body_hash = hashlib.sha256(body).hexdigest()
        return "\n".join((method.upper(), path, timestamp, nonce, body_hash)).encode("utf-8")

    def sign(self, method: str, path: str, timestamp: str, nonce: str, body: bytes) -> str:
        return hmac.new(self.secret, self.canonical(method, path, timestamp, nonce, body), hashlib.sha256).hexdigest()

    def verify(self, request: Request, body: bytes) -> str | None:
        """Return an error reason, or None when the request is correctly signed."""
        signature = request.headers.get(SIGNATURE_HEADER, "")
        timestamp = request.headers.get(TIMESTAMP_HEADER, "")
        nonce = request.headers.get(NONCE_HEADER, "")
        if not signature or not timestamp or not nonce:
            return "missing signature headers"
        if not timestamp.isdigit():
            return "invalid timestamp"
        if abs(time.time() - int(timestamp)) > self.max_skew_seconds:
            return "timestamp outside the allowed window"
        if not 16 <= len(nonce) <= 128:
            return "invalid nonce"
        expected = self.sign(request.method, request.url.path, timestamp, nonce, body)
        if not hmac.compare_digest(expected, signature.lower()):
            return "invalid signature"
        if not self.nonces.register(nonce):
            return "replayed request"
        return None


def client_ip(request: Request) -> str:
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def parse_version(value: str) -> tuple[int, ...]:
    parts: list[int] = []
    for chunk in value.strip().split("."):
        digits = ""
        for ch in chunk:
            if not ch.isdigit():
                break
            digits += ch
        if not digits:
            break
        parts.append(int(digits))
        if len(digits) != len(chunk):
            break  # "0-beta" ends the numeric part
    return tuple(parts) or (0,)


def client_version_allowed(request: Request) -> bool:
    if not settings.min_client_version:
        return True
    reported = request.headers.get(CLIENT_VERSION_HEADER)
    if not reported:
        return False
    return parse_version(reported) >= parse_version(settings.min_client_version)


def apply_security_headers(request: Request, response: Response) -> None:
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    # Hide the framework fingerprint instead of advertising uvicorn/starlette versions.
    response.headers["Server"] = "cashya"
    if request.url.path.startswith(settings.api_v1_prefix):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    else:
        response.headers["Cache-Control"] = "no-cache"
    if settings.hsts_enabled:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"


auth_rate_limiter = SlidingWindowLimiter(settings.auth_rate_limit_attempts, settings.auth_rate_limit_window_seconds)
global_rate_limiter = SlidingWindowLimiter(settings.global_rate_limit_per_minute, 60)
signature_verifier = RequestSignatureVerifier(settings.request_signing_secret, settings.request_signature_max_skew_seconds)
