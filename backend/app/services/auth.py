import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    utcnow,
    verify_password,
)
from app.models.email_challenge import EmailChallenge
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RegisterRequest, TokenPair, UserUpdate


class AuthError(Exception):
    """Business rule violation raised by the auth service; routers map it to an HTTP status."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def create_email_challenge(db: Session, user: User, purpose: str) -> str:
    now = utcnow()
    db.execute(
        update(EmailChallenge)
        .where(
            EmailChallenge.user_id == user.id,
            EmailChallenge.purpose == purpose,
            EmailChallenge.used_at.is_(None),
        )
        .values(used_at=now)
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = hmac.new(settings.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()
    db.add(
        EmailChallenge(
            user_id=user.id,
            purpose=purpose,
            code_hash=code_hash,
            expires_at=now + timedelta(minutes=15),
        )
    )
    db.commit()
    return code


def _consume_email_challenge(db: Session, user: User, purpose: str, code: str) -> EmailChallenge:
    challenge = db.scalar(
        select(EmailChallenge)
        .where(EmailChallenge.user_id == user.id, EmailChallenge.purpose == purpose)
        .order_by(EmailChallenge.created_at.desc())
        .limit(1)
    )
    now = utcnow()
    if challenge is None or challenge.used_at is not None or challenge.failed_attempts >= 5:
        raise AuthError("Invalid or expired code", 400)
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise AuthError("Invalid or expired code", 400)

    code_hash = hmac.new(settings.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(challenge.code_hash, code_hash):
        values: dict[str, int | datetime] = {"failed_attempts": challenge.failed_attempts + 1}
        if challenge.failed_attempts + 1 >= 5:
            values["used_at"] = now
        updated = db.execute(
            update(EmailChallenge)
            .where(
                EmailChallenge.id == challenge.id,
                EmailChallenge.used_at.is_(None),
                EmailChallenge.failed_attempts == challenge.failed_attempts,
            )
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        if updated.rowcount != 1:
            db.rollback()
            raise AuthError("Invalid or expired code", 400)
        db.commit()
        raise AuthError("Invalid or expired code", 400)

    updated = db.execute(
        update(EmailChallenge)
        .where(
            EmailChallenge.id == challenge.id,
            EmailChallenge.used_at.is_(None),
            EmailChallenge.failed_attempts == challenge.failed_attempts,
            EmailChallenge.expires_at > now,
        )
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    )
    if updated.rowcount != 1:
        db.rollback()
        raise AuthError("Invalid or expired code", 400)
    return challenge


def verify_email_address(db: Session, user: User, code: str) -> None:
    _consume_email_challenge(db, user, "verify_email", code)
    user.email_verified = True
    db.commit()


def reset_password_with_code(db: Session, email: str, code: str, new_password: str) -> User:
    user = find_user_by_email(db, email)
    if user is None:
        raise AuthError("Invalid or expired code", 400)
    _consume_email_challenge(db, user, "password_reset", code)
    user.password_hash = hash_password(new_password)
    user.email_verified = True
    user.updated_at = utcnow()
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    db.commit()
    return user


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


def register_user(db: Session, data: RegisterRequest) -> User:
    if find_user_by_email(db, data.email):
        raise AuthError("An account with this email already exists", 409)
    user = User(email=data.email.lower(), name=data.name.strip(), password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# Hash verified when the e-mail does not exist, so "unknown user" and "wrong password" take the same time.
_DUMMY_PASSWORD_HASH = hash_password("cashya-timing-guard-not-a-real-password")


def authenticate_user(db: Session, data: LoginRequest) -> User | None:
    user = find_user_by_email(db, data.email)
    if user is None:
        verify_password(data.password, _DUMMY_PASSWORD_HASH)
        return None
    if not verify_password(data.password, user.password_hash) or not user.is_active:
        return None
    return user


def issue_token_pair(db: Session, user: User, device_name: str | None = None) -> TokenPair:
    access_token, expires_in = create_access_token(user.id)
    raw_refresh = generate_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hash_refresh_token(raw_refresh), expires_at=refresh_token_expiry(), device_name=device_name))
    db.commit()
    return TokenPair(access_token=access_token, refresh_token=raw_refresh, expires_in=expires_in)


def rotate_refresh_token(db: Session, raw_refresh: str) -> tuple[User, TokenPair]:
    """Validate a refresh token, revoke it and issue a brand-new pair (refresh token rotation)."""
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_refresh)))
    if stored is None:
        raise AuthError("Invalid refresh token", 401)
    if not stored.is_valid:
        # Reuse of a revoked token is a strong signal of theft: revoke the whole family for safety.
        revoke_all_refresh_tokens(db, stored.user_id)
        raise AuthError("Refresh token expired or revoked", 401)
    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise AuthError("Account is not active", 401)
    stored.revoked_at = utcnow()
    pair = issue_token_pair(db, user, stored.device_name)
    stored.replaced_by = db.scalar(select(RefreshToken.id).where(RefreshToken.token_hash == hash_refresh_token(pair.refresh_token)))
    db.commit()
    return user, pair


def revoke_refresh_token(db: Session, user: User, raw_refresh: str) -> bool:
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_refresh), RefreshToken.user_id == user.id))
    if stored is None or stored.revoked_at is not None:
        return False
    stored.revoked_at = utcnow()
    db.commit()
    return True


def revoke_all_refresh_tokens(db: Session, user_id: str) -> None:
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)).values(revoked_at=utcnow()))
    db.commit()


def update_profile(db: Session, user: User, data: UserUpdate) -> User:
    values = data.model_dump(exclude_unset=True, exclude={"current_password"})
    if "email" in values and values["email"] is not None:
        new_email = values["email"].lower()
        if new_email != user.email:
            if not data.current_password or not verify_password(data.current_password, user.password_hash):
                raise AuthError("Current password is required to change the e-mail", 403)
            existing = find_user_by_email(db, new_email)
            if existing and existing.id != user.id:
                raise AuthError("An account with this email already exists", 409)
            user.email = new_email
            user.email_verified = False
    if "name" in values and values["name"] is not None:
        user.name = values["name"].strip()
    if "avatar_url" in values:
        user.avatar_url = values["avatar_url"]
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, data: PasswordChangeRequest) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise AuthError("Current password is incorrect", 403)
    if data.current_password == data.new_password:
        raise AuthError("New password must be different from the current one", 400)
    user.password_hash = hash_password(data.new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    # Every other device must sign in again after a password change.
    revoke_all_refresh_tokens(db, user.id)


def delete_account(db: Session, user: User, password: str) -> None:
    if not verify_password(password, user.password_hash):
        raise AuthError("Password is incorrect", 403)
    db.delete(user)
    db.commit()
