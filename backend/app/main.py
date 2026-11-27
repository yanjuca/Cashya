import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables
from app.core.hardening import apply_security_headers, auth_rate_limiter, client_ip, client_version_allowed, global_rate_limiter, signature_verifier
from app.routers import auth, cards, dashboard, expenses, groups, inbox, statistics, sync, users
from app.services.email_scheduler import run_email_scheduler

logger = logging.getLogger("cashya")

API_PREFIX = settings.api_v1_prefix
RATE_LIMITED_PATHS = {
    f"{API_PREFIX}/auth/login",
    f"{API_PREFIX}/auth/register",
    f"{API_PREFIX}/auth/refresh",
    f"{API_PREFIX}/auth/password-reset/request",
    f"{API_PREFIX}/auth/password-reset/confirm",
    f"{API_PREFIX}/auth/email-verification/request",
    f"{API_PREFIX}/auth/email-verification/confirm",
}
PUBLIC_PATHS = {f"{API_PREFIX}/health", f"{API_PREFIX}/openapi.json"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    scheduler_task = asyncio.create_task(run_email_scheduler())
    yield
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Cashya API",
    version="1.0.0",
    description="Backend for the Cashya mobile app: accounts, cards, personal and shared expenses, offline-first sync.",
    lifespan=lifespan,
    # In production the schema is not published: it is the first thing an attacker maps.
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url=f"{API_PREFIX}/openapi.json" if settings.docs_enabled else None,
)


def error_response(code: str, message: str, details: list[dict] | None = None, status_code: int = 400, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "error": {"code": code, "message": message, "details": details or []}}, headers=headers)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exception: HTTPException) -> JSONResponse:
    code_by_status = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
    }
    code = code_by_status.get(exception.status_code, "HTTP_ERROR")
    details = exception.detail if isinstance(exception.detail, list) else []
    message = exception.detail if isinstance(exception.detail, str) else "Request failed"
    return error_response(code, message, details, exception.status_code, exception.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exception: RequestValidationError) -> JSONResponse:
    details = [{"field": ".".join(str(part) for part in error["loc"] if part != "body"), "issue": error["msg"]} for error in exception.errors()]
    return error_response("VALIDATION_ERROR", "Request validation failed", details, 422)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exception: Exception) -> JSONResponse:
    # Never leak stack traces, SQL or file paths to callers; the details go to the server log only.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exception)
    return error_response("INTERNAL_ERROR", "Unexpected server error", status_code=500)


@app.middleware("http")
async def security_middleware(request: Request, call_next) -> Response:
    path = request.url.path
    is_api = path.startswith(API_PREFIX) and path not in PUBLIC_PATHS

    if request.method in {"POST", "PUT", "PATCH"}:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > settings.max_request_body_bytes:
            return error_response("PAYLOAD_TOO_LARGE", "Request body too large", status_code=413)

    ip = client_ip(request)
    if is_api:
        allowed, retry_after = global_rate_limiter.allowed(ip)
        if not allowed:
            return error_response("RATE_LIMITED", "Too many requests", status_code=429, headers={"Retry-After": str(retry_after)})

    if path in RATE_LIMITED_PATHS and request.method == "POST":
        allowed, retry_after = auth_rate_limiter.allowed(ip)
        if not allowed:
            return error_response("RATE_LIMITED", "Too many authentication attempts", status_code=429, headers={"Retry-After": str(retry_after)})

    if is_api and not client_version_allowed(request):
        return error_response("UPGRADE_REQUIRED", "Please update the Cashya app to continue", status_code=426)

    if is_api and signature_verifier.enabled and request.method != "OPTIONS":
        reason = signature_verifier.verify(request, await request.body())
        if reason is not None:
            logger.warning("Rejected unsigned request from %s on %s: %s", ip, path, reason)
            return error_response("INVALID_SIGNATURE", "Request signature is missing or invalid", status_code=401)

    response = await call_next(request)
    apply_security_headers(request, response)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Client-Version", "X-Cashya-Signature", "X-Cashya-Timestamp", "X-Cashya-Nonce"],
)

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{API_PREFIX}/users", tags=["users"])
app.include_router(cards.router, prefix=f"{API_PREFIX}/cards", tags=["cards"])
app.include_router(expenses.router, prefix=f"{API_PREFIX}/expenses", tags=["expenses"])
app.include_router(groups.router, prefix=f"{API_PREFIX}/groups", tags=["groups"])
app.include_router(sync.router, prefix=f"{API_PREFIX}/sync", tags=["sync"])
app.include_router(inbox.router, prefix=f"{API_PREFIX}/inbox", tags=["inbox"])
app.include_router(dashboard.router, prefix=f"{API_PREFIX}/dashboard", tags=["dashboard"])
app.include_router(statistics.router, prefix=f"{API_PREFIX}/statistics", tags=["statistics"])


@app.get("/", tags=["health"])
@app.get(f"{API_PREFIX}/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "cashya-api", "version": app.version}
