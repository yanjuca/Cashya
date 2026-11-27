import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import hash_refresh_token, verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RegisterRequest, UserUpdate
from app.services.auth import (
    AuthError,
    authenticate_user,
    change_password,
    delete_account,
    find_user_by_email,
    issue_token_pair,
    register_user,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    update_profile,
)


def test_find_user_by_email_is_case_insensitive(user, db_session):
    assert find_user_by_email(db_session, "OWNER@EXAMPLE.COM").id == user.id
    assert find_user_by_email(db_session, "missing@example.com") is None


def test_register_user_normalizes_email_and_name(db_session):
    data = RegisterRequest(email="NEW@EXAMPLE.COM", name="  New User  ", password="password123")
    user = register_user(db_session, data)
    assert user.email == "new@example.com"
    assert user.name == "New User"
    assert verify_password("password123", user.password_hash)


def test_register_user_rejects_duplicate_email_case_insensitively(user, db_session):
    with pytest.raises(AuthError) as error:
        register_user(db_session, RegisterRequest(email="OWNER@example.com", name="Duplicate", password="password123"))
    assert error.value.status_code == 409


def test_authenticate_user_returns_matching_active_user(user, db_session):
    result = authenticate_user(db_session, LoginRequest(email=user.email, password="password123"))
    assert result.id == user.id


@pytest.mark.parametrize(
    ("email", "password", "active"),
    [
        ("owner@example.com", "wrong-password", True),
        ("missing@example.com", "password123", True),
        ("inactive@example.com", "password123", False),
    ],
)
def test_authenticate_user_returns_none_for_wrong_unknown_or_inactive_account(email, password, active, make_user, user, db_session):
    if email == "inactive@example.com":
        make_user(email=email, password=password, is_active=active)
    result = authenticate_user(db_session, LoginRequest(email=email, password=password))
    assert result is None


def test_issue_token_pair_persists_hash_of_refresh_token(user, db_session):
    pair = issue_token_pair(db_session, user, "Windows laptop")
    stored = db_session.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id))
    assert pair.access_token
    assert pair.refresh_token
    assert pair.token_type == "Bearer"
    assert pair.expires_in > 0
    assert stored.token_hash == hash_refresh_token(pair.refresh_token)
    assert stored.token_hash != pair.refresh_token
    assert stored.device_name == "Windows laptop"


def test_rotate_refresh_token_revokes_old_token_and_issues_new_pair(user, db_session):
    original = issue_token_pair(db_session, user, "Phone")
    old_record = db_session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(original.refresh_token)))
    rotated_user, replacement = rotate_refresh_token(db_session, original.refresh_token)
    db_session.refresh(old_record)
    assert rotated_user.id == user.id
    assert replacement.refresh_token != original.refresh_token
    assert old_record.revoked_at is not None
    assert old_record.replaced_by is not None
    new_record = db_session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(replacement.refresh_token)))
    assert new_record.device_name == "Phone"


def test_rotate_refresh_token_rejects_unknown_token(db_session):
    with pytest.raises(AuthError) as error:
        rotate_refresh_token(db_session, "unknown-refresh-token")
    assert error.value.status_code == 401


def test_rotate_refresh_token_reuse_revokes_remaining_sessions(user, db_session):
    first = issue_token_pair(db_session, user, "First device")
    second = issue_token_pair(db_session, user, "Second device")
    rotate_refresh_token(db_session, first.refresh_token)
    with pytest.raises(AuthError) as error:
        rotate_refresh_token(db_session, first.refresh_token)
    assert error.value.status_code == 401
    active_tokens = list(db_session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))))
    assert active_tokens == []
    assert second.refresh_token


def test_rotate_refresh_token_rejects_inactive_account(user, db_session):
    pair = issue_token_pair(db_session, user)
    user.is_active = False
    db_session.commit()
    with pytest.raises(AuthError) as error:
        rotate_refresh_token(db_session, pair.refresh_token)
    assert error.value.status_code == 401


def test_revoke_refresh_token_revokes_only_owners_token(user, other_user, db_session):
    pair = issue_token_pair(db_session, user)
    assert revoke_refresh_token(db_session, other_user, pair.refresh_token) is False
    assert revoke_refresh_token(db_session, user, pair.refresh_token) is True
    assert revoke_refresh_token(db_session, user, pair.refresh_token) is False


def test_revoke_all_refresh_tokens_revokes_only_active_tokens(user, other_user, db_session):
    own = issue_token_pair(db_session, user)
    already_revoked = issue_token_pair(db_session, user)
    revoke_refresh_token(db_session, user, already_revoked.refresh_token)
    issue_token_pair(db_session, other_user)
    revoke_all_refresh_tokens(db_session, user.id)
    own_record = db_session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(own.refresh_token)))
    revoked_record = db_session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(already_revoked.refresh_token)))
    assert own_record.revoked_at is not None
    assert revoked_record.revoked_at is not None
    other_record = db_session.scalar(select(RefreshToken).where(RefreshToken.user_id == other_user.id))
    assert other_record.revoked_at is None


def test_update_profile_trims_name_and_updates_avatar(user, db_session):
    updated = update_profile(db_session, user, UserUpdate(name="  Updated  ", avatarUrl="https://example.com/avatar.png"))
    assert updated.name == "Updated"
    assert updated.avatar_url == "https://example.com/avatar.png"
    assert updated.updated_at is not None


def test_update_profile_requires_current_password_when_email_changes(user, db_session):
    with pytest.raises(AuthError) as error:
        update_profile(db_session, user, UserUpdate(email="new@example.com"))
    assert error.value.status_code == 403


def test_update_profile_changes_email_with_correct_password(user, db_session):
    updated = update_profile(db_session, user, UserUpdate(email="NEW@example.com", currentPassword="password123"))
    assert updated.email == "new@example.com"


def test_update_profile_rejects_duplicate_email(user, other_user, db_session):
    with pytest.raises(AuthError) as error:
        update_profile(db_session, user, UserUpdate(email=other_user.email, currentPassword="password123"))
    assert error.value.status_code == 409


def test_update_profile_allows_same_email_without_password(user, db_session):
    updated = update_profile(db_session, user, UserUpdate(email=user.email))
    assert updated.email == user.email


def test_change_password_updates_hash_and_revokes_sessions(user, db_session):
    first = issue_token_pair(db_session, user)
    second = issue_token_pair(db_session, user)
    change_password(db_session, user, PasswordChangeRequest(currentPassword="password123", newPassword="newpassword456"))
    assert verify_password("newpassword456", user.password_hash)
    assert not verify_password("password123", user.password_hash)
    active = list(db_session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))))
    assert active == []
    assert first.refresh_token != second.refresh_token


def test_change_password_rejects_wrong_current_password(user, db_session):
    with pytest.raises(AuthError) as error:
        change_password(db_session, user, PasswordChangeRequest(currentPassword="wrongpass1", newPassword="newpassword456"))
    assert error.value.status_code == 403


def test_change_password_rejects_same_password(user, db_session):
    with pytest.raises(AuthError) as error:
        change_password(db_session, user, PasswordChangeRequest(currentPassword="password123", newPassword="password123"))
    assert error.value.status_code == 400


def test_delete_account_requires_correct_password(user, db_session):
    with pytest.raises(AuthError) as error:
        delete_account(db_session, user, "wrong-password")
    assert error.value.status_code == 403
    assert db_session.get(User, user.id) is not None


def test_delete_account_removes_user(user, db_session):
    user_id = user.id
    delete_account(db_session, user, "password123")
    assert db_session.get(User, user_id) is None
