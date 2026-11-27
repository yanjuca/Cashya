from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt
from pydantic import ValidationError

from app.core import database, security
from app.core.config import Settings, settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_current_user,
)


VALID_SECRET = "unit-test-secret-key-with-more-than-32-characters"


def make_settings(**overrides):
    return Settings(_env_file=None, secret_key=VALID_SECRET, **overrides)


def test_settings_normalize_environment_and_derive_production_properties():
    development = make_settings(environment=" Development ", cors_origins=" https://a.example, ,https://b.example ")
    production = make_settings(environment=" Production ")

    assert development.environment == "development"
    assert development.is_production is False
    assert development.docs_enabled is True
    assert development.cors_origin_list == ["https://a.example", "https://b.example"]
    assert production.is_production is True
    assert production.docs_enabled is False


def test_settings_disable_docs_when_expose_docs_is_false():
    configured = make_settings(expose_docs=False)
    assert configured.docs_enabled is False


@pytest.mark.parametrize("secret", ["short", "change-this-local-secret", "test-secret"])
def test_settings_reject_weak_or_placeholder_secret_keys(secret):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, secret_key=secret)


@pytest.mark.parametrize("minutes", [4, 1441])
def test_settings_reject_access_token_expiration_outside_allowed_range(minutes):
    with pytest.raises(ValidationError):
        make_settings(access_token_expire_minutes=minutes)


@pytest.mark.parametrize("days", [0, 366])
def test_settings_reject_refresh_expiration_outside_allowed_range(days):
    with pytest.raises(ValidationError):
        make_settings(refresh_token_expire_days=days)


def test_settings_reject_unknown_environment():
    with pytest.raises(ValidationError):
        make_settings(environment="staging")


def test_settings_accept_empty_or_long_request_signing_secret():
    assert make_settings(request_signing_secret="").request_signing_secret == ""
    assert make_settings(request_signing_secret="s" * 32).request_signing_secret == "s" * 32


def test_settings_reject_short_request_signing_secret():
    with pytest.raises(ValidationError):
        make_settings(request_signing_secret="too-short")


@pytest.mark.parametrize("error_type", [ValueError, TypeError])
def test_verify_password_returns_false_for_supported_verification_errors(
    monkeypatch, error_type
):
    class BrokenPasswordHash:
        def verify(self, password, hashed_password):
            raise error_type("invalid password hash input")

    monkeypatch.setattr(security, "password_hash", BrokenPasswordHash())

    assert security.verify_password("password123", "malformed-hash") is False


def test_decode_access_token_rejects_token_with_wrong_type():
    token = jwt.encode(
        {
            "sub": "user-1",
            "typ": "refresh",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        },
        settings.secret_key,
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as error:
        decode_access_token(token)
    assert error.value.status_code == 401


def test_get_current_user_returns_active_user_for_valid_access_token(db_session, user):
    token, _ = create_access_token(user.id)
    assert get_current_user(token, db_session).id == user.id


def test_get_current_user_rejects_unknown_user(db_session):
    token, _ = create_access_token("missing-user-id")
    with pytest.raises(HTTPException) as error:
        get_current_user(token, db_session)
    assert error.value.status_code == 401


def test_get_current_user_rejects_inactive_user(db_session, make_user):
    inactive = make_user(email="inactive-security@example.com", is_active=False)
    token, _ = create_access_token(inactive.id)

    with pytest.raises(HTTPException) as error:
        get_current_user(token, db_session)
    assert error.value.status_code == 401


def test_get_db_closes_session_after_generator_finishes(monkeypatch):
    class FakeSession:
        closed = False

        def close(self):
            self.closed = True

    session = FakeSession()
    monkeypatch.setattr(database, "SessionLocal", lambda: session)
    generator = database.get_db()

    assert next(generator) is session
    with pytest.raises(StopIteration):
        next(generator)
    assert session.closed is True
