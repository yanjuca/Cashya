from contextlib import asynccontextmanager
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables
from app.routers import auth, budgets, categories, expenses, statistics, transactions


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Cashya API", version="1.0.0", lifespan=lifespan)


def error_response(code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    return JSONResponse(status_code=400, content={"success": False, "error": {"code": code, "message": message, "details": details or []}})


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exception: HTTPException) -> JSONResponse:
    code_by_status = {400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 429: "RATE_LIMITED"}
    code = code_by_status.get(exception.status_code, "HTTP_ERROR")
    details = exception.detail if isinstance(exception.detail, list) else []
    message = exception.detail if isinstance(exception.detail, str) else "Request failed"
    response = error_response(code, message, details)
    response.status_code = exception.status_code
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exception: RequestValidationError) -> JSONResponse:
    details = [{"field": ".".join(str(part) for part in error["loc"]), "issue": error["msg"]} for error in exception.errors()]
    response = error_response("VALIDATION_ERROR", "Request validation failed", details)
    response.status_code = 422
    return response


class AuthRateLimiter:
    def __init__(self, limit: int = 10, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self.attempts: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def allowed(self, key: str) -> tuple[bool, int]:
        now = monotonic()
        with self.lock:
            timestamps = self.attempts[key]
            while timestamps and now - timestamps[0] >= self.window_seconds:
                timestamps.popleft()
            if len(timestamps) >= self.limit:
                return False, max(1, int(self.window_seconds - (now - timestamps[0])))
            timestamps.append(now)
            return True, 0


auth_rate_limiter = AuthRateLimiter()


@app.middleware("http")
async def security_middleware(request: Request, call_next) -> Response:
    if request.method in {"POST", "PUT", "PATCH"}:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.max_request_body_bytes:
            return JSONResponse(status_code=413, content={"success": False, "error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request body too large", "details": []}})

    if request.url.path in {"/auth/login", "/auth/register"} and request.method == "POST":
        client_host = request.client.host if request.client else "unknown"
        allowed, retry_after = auth_rate_limiter.allowed(client_host)
        if not allowed:
                return JSONResponse(status_code=429, content={"success": False, "error": {"code": "RATE_LIMITED", "message": "Too many authentication attempts", "details": []}}, headers={"Retry-After": str(retry_after)})

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith(("/auth", "/transactions", "/expenses", "/sync", "/inbox", "/statistics", "/budgets", "/categories")) else "no-cache"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Client-Version"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
app.include_router(expenses.spec_router, tags=["sync", "inbox"])
app.include_router(categories.router, prefix="/categories", tags=["categories"])
app.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
app.include_router(statistics.router, prefix="/statistics", tags=["statistics"])


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "cashya-api"}
    