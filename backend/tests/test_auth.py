import re
from types import SimpleNamespace

from tests.conftest import API, bearer, register


def test_register_login_refresh_and_profile(client):
    auth = register(client, email="person@example.com", name="Person")
    assert auth["tokenType"] == "Bearer"
    assert auth["expiresIn"] > 0
    assert auth["user"]["email"] == "person@example.com"
    assert "refreshToken" in auth

    login = client.post(f"{API}/auth/login", json={"email": "person@example.com", "password": "password123"})
    assert login.status_code == 200
    assert login.json()["data"]["accessToken"]

    me = client.get(f"{API}/users/me", headers=bearer(auth))
    assert me.status_code == 200
    assert me.json()["data"]["name"] == "Person"
    assert "passwordHash" not in me.json()["data"]

    refreshed = client.post(f"{API}/auth/refresh", json={"refreshToken": auth["refreshToken"]})
    assert refreshed.status_code == 200
    new_pair = refreshed.json()["data"]
    assert new_pair["refreshToken"] != auth["refreshToken"]

    # Rotation: the old refresh token is revoked, reusing it is rejected.
    reused = client.post(f"{API}/auth/refresh", json={"refreshToken": auth["refreshToken"]})
    assert reused.status_code == 401

    assert client.get(f"{API}/users/me", headers=bearer(new_pair)).status_code == 200


def test_refresh_token_is_not_accepted_as_access_token(client):
    auth = register(client)
    response = client.get(f"{API}/users/me", headers={"Authorization": f"Bearer {auth['refreshToken']}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_duplicate_registration_is_rejected(client):
    payload = {"email": "duplicate@example.com", "name": "Person", "password": "password123"}
    assert client.post(f"{API}/auth/register", json=payload).status_code == 201
    assert client.post(f"{API}/auth/register", json=payload).status_code == 409


def test_validation_errors_use_documented_envelope(client):
    response = client.post(f"{API}/auth/register", json={"email": "invalid", "name": "", "password": "short"})
    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert {item["field"] for item in response.json()["error"]["details"]} == {"email", "name", "password"}


def test_profile_update_name_email_and_password(client):
    auth = register(client, email="old@example.com", name="Old Name")
    headers = bearer(auth)

    renamed = client.patch(f"{API}/users/me", json={"name": "New Name"}, headers=headers)
    assert renamed.status_code == 200
    assert renamed.json()["data"]["name"] == "New Name"

    without_password = client.patch(f"{API}/users/me", json={"email": "new@example.com"}, headers=headers)
    assert without_password.status_code == 403

    changed_email = client.patch(f"{API}/users/me", json={"email": "new@example.com", "currentPassword": "password123"}, headers=headers)
    assert changed_email.status_code == 200
    assert changed_email.json()["data"]["email"] == "new@example.com"

    wrong_current = client.post(f"{API}/users/me/change-password", json={"currentPassword": "wrong", "newPassword": "newpass456"}, headers=headers)
    assert wrong_current.status_code == 403

    changed = client.post(f"{API}/users/me/change-password", json={"currentPassword": "password123", "newPassword": "newpass456"}, headers=headers)
    assert changed.status_code == 200

    # Old refresh tokens are revoked after a password change; the new password works for login.
    assert client.post(f"{API}/auth/refresh", json={"refreshToken": auth["refreshToken"]}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": "new@example.com", "password": "password123"}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": "new@example.com", "password": "newpass456"}).status_code == 200


def test_logout_revokes_refresh_token(client):
    auth = register(client)
    logout = client.post(f"{API}/auth/logout", json={"refreshToken": auth["refreshToken"]}, headers=bearer(auth))
    assert logout.status_code == 200
    assert client.post(f"{API}/auth/refresh", json={"refreshToken": auth["refreshToken"]}).status_code == 401


def test_delete_account_requires_password(client):
    auth = register(client, email="bye@example.com")
    assert client.request("DELETE", f"{API}/users/me", json={"password": "nope"}, headers=bearer(auth)).status_code == 403
    assert client.request("DELETE", f"{API}/users/me", json={"password": "password123"}, headers=bearer(auth)).status_code == 200
    assert client.post(f"{API}/auth/login", json={"email": "bye@example.com", "password": "password123"}).status_code == 401


def test_password_reset_code_changes_password_and_is_single_use(client, monkeypatch):
    register(client, email="reset@example.com")
    sent = []
    monkeypatch.setattr("app.routers.auth.settings", SimpleNamespace(email_configured=True))
    monkeypatch.setattr("app.routers.auth.send_email_best_effort", lambda *args: sent.append(args))

    requested = client.post(f"{API}/auth/password-reset/request", json={"email": "reset@example.com"})
    assert requested.status_code == 200
    assert requested.json()["success"] is True
    code = re.search(r"code is (\d{6})", sent[-1][2]).group(1)

    wrong_code = "000001" if code != "000001" else "000002"
    assert client.post(
        f"{API}/auth/password-reset/confirm",
        json={"email": "reset@example.com", "code": wrong_code, "newPassword": "changed123"},
    ).status_code == 400
    confirmed = client.post(
        f"{API}/auth/password-reset/confirm",
        json={"email": "reset@example.com", "code": code, "newPassword": "changed123"},
    )
    assert confirmed.status_code == 200
    assert client.post(
        f"{API}/auth/password-reset/confirm",
        json={"email": "reset@example.com", "code": code, "newPassword": "changed456"},
    ).status_code == 400
    assert client.post(
        f"{API}/auth/login",
        json={"email": "reset@example.com", "password": "changed123"},
    ).status_code == 200


def test_email_verification_and_preferences(client, monkeypatch):
    auth = register(client, email="verify@example.com")
    sent = []
    monkeypatch.setattr("app.routers.auth.settings", SimpleNamespace(email_configured=True))
    monkeypatch.setattr("app.routers.auth.send_email_best_effort", lambda *args: sent.append(args))

    requested = client.post(f"{API}/auth/email-verification/request", headers=bearer(auth))
    assert requested.status_code == 200
    code = re.search(r"code is (\d{6})", sent[-1][2]).group(1)
    verified = client.post(
        f"{API}/auth/email-verification/confirm",
        json={"code": code},
        headers=bearer(auth),
    )
    assert verified.status_code == 200
    assert client.get(f"{API}/users/me", headers=bearer(auth)).json()["data"]["emailVerified"] is True

    updated = client.patch(
        f"{API}/users/me/email-preferences",
        json={"emailNotificationsEnabled": False, "emailReportsEnabled": False},
        headers=bearer(auth),
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["emailNotificationsEnabled"] is False
    assert updated.json()["data"]["emailReportsEnabled"] is False
