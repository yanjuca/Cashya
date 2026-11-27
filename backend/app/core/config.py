from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./cashya.db"
    secret_key: str = ""
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    jwt_issuer: str = "cashya-api"
    jwt_audience: str = "cashya-app"
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"
    max_request_body_bytes: int = 1_048_576
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_seconds: int = 60
    api_v1_prefix: str = "/api/v1"

    # Hardening against API probing / reverse engineering. See app/core/hardening.py.
    environment: str = "development"  # development | production
    expose_docs: bool = True  # Swagger, ReDoc and openapi.json; set false in production
    trust_proxy_headers: bool = False  # honour X-Forwarded-For only behind a trusted reverse proxy
    global_rate_limit_per_minute: int = 300  # per client IP, every /api/v1 route; 0 disables
    request_signing_secret: str = ""  # shared with the mobile app; empty disables request signing
    request_signature_max_skew_seconds: int = 300
    min_client_version: str = ""  # e.g. "1.2.0"; requests from older X-Client-Version are refused
    hsts_enabled: bool = False  # only when served over HTTPS
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Cashya"
    smtp_starttls: bool = True
    smtp_use_ssl: bool = False
    email_schedule_hour_utc: int = 12
    monthly_report_prompt: str = (
        "Congratulations on another month of tracking your finances with Cashya. "
        "Review your pending expenses and card limits to stay on top of your budget."
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        if len(value) < 32 or value in {"change-this-local-secret", "test-secret"}:
            raise ValueError("SECRET_KEY must contain at least 32 unpredictable characters")
        return value

    @field_validator("access_token_expire_minutes")
    @classmethod
    def validate_token_expiration(cls, value: int) -> int:
        if not 5 <= value <= 1440:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be between 5 and 1440")
        return value

    @field_validator("refresh_token_expire_days")
    @classmethod
    def validate_refresh_expiration(cls, value: int) -> int:
        if not 1 <= value <= 365:
            raise ValueError("REFRESH_TOKEN_EXPIRE_DAYS must be between 1 and 365")
        return value

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"development", "production", "test"}:
            raise ValueError("ENVIRONMENT must be development, production or test")
        return value

    @field_validator("request_signing_secret")
    @classmethod
    def validate_signing_secret(cls, value: str) -> str:
        if value and len(value) < 32:
            raise ValueError("REQUEST_SIGNING_SECRET must contain at least 32 characters when set")
        return value

    @field_validator("email_schedule_hour_utc")
    @classmethod
    def validate_email_schedule_hour(cls, value: int) -> int:
        if not 0 <= value <= 23:
            raise ValueError("EMAIL_SCHEDULE_HOUR_UTC must be between 0 and 23")
        return value

    @field_validator("smtp_port")
    @classmethod
    def validate_smtp_port(cls, value: int) -> int:
        if not 1 <= value <= 65535:
            raise ValueError("SMTP_PORT must be between 1 and 65535")
        return value

    @field_validator("smtp_password")
    @classmethod
    def validate_smtp_credentials(cls, value: str, info) -> str:
        username = info.data.get("smtp_username", "")
        if bool(username) != bool(value):
            raise ValueError("SMTP_USERNAME and SMTP_PASSWORD must either both be set or both be empty")
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def docs_enabled(self) -> bool:
        return self.expose_docs and not self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def email_configured(self) -> bool:
        return bool(self.smtp_host.strip() and self.smtp_from_email.strip())

    @property
    def email_console_fallback(self) -> bool:
        """Development without SMTP: reset/verification emails are written to the API log instead of sent."""
        return not self.email_configured and self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
