def test_register_login_and_current_user(client):
    register = client.post("/auth/register", json={"email": "person@example.com", "name": "Person", "password": "password123"})
    assert register.status_code == 201
    token = register.json()["data"]["token"]
    assert register.json()["data"]["user"]["email"] == "person@example.com"

    login = client.post("/auth/login", json={"email": "person@example.com", "password": "password123"})
    assert login.status_code == 200

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["name"] == "Person"


def test_duplicate_registration_is_rejected(client):
    payload = {"email": "duplicate@example.com", "name": "Person", "password": "password123"}
    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 409


def test_validation_errors_use_documented_envelope(client):
    response = client.post("/auth/register", json={"email": "invalid", "name": "", "password": "short"})
    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["details"]
