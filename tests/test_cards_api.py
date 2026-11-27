from tests.conftest import API

CARD = {
    "id": "c1a2b3c4-0000-4000-8000-000000000001",
    "holderName": "JOÃO SILVA",
    "brand": "visa",
    "type": "Debit",
    "lastDigits": "1234",
    "expiryDate": "12/28",
    "limit": 3000,
    "colorAccent": "#ff453a",
}


def test_card_crud_and_wallet_summary(client, auth_headers):
    created = client.post(f"{API}/cards", json=CARD, headers=auth_headers)
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    assert data["id"] == CARD["id"]
    assert data["holderName"] == "JOÃO SILVA"
    assert data["lastDigits"] == "1234"
    assert data["limit"] == 3000.0
    assert data["isArchived"] is False
    assert data["createdAt"].endswith("Z")

    listed = client.get(f"{API}/cards", headers=auth_headers)
    assert listed.status_code == 200
    assert [card["id"] for card in listed.json()["data"]] == [CARD["id"]]

    patched = client.patch(f"{API}/cards/{CARD['id']}", json={"limit": 5000, "holderName": "MAIN WALLET"}, headers=auth_headers)
    assert patched.status_code == 200
    assert patched.json()["data"]["limit"] == 5000.0
    assert patched.json()["data"]["holderName"] == "MAIN WALLET"

    replaced = client.put(f"{API}/cards/{CARD['id']}", json={**CARD, "brand": "MASTERCARD", "type": "credit"}, headers=auth_headers)
    assert replaced.status_code == 200
    assert replaced.json()["data"]["brand"] == "mastercard"
    assert replaced.json()["data"]["type"] == "Credit"

    for payload in [
        {"description": "Mercado", "amount": 300, "person": "João", "date": "2026-09-10T12:00:00Z", "tags": ["Mercado"], "paid": False, "cardId": CARD["id"]},
        {"description": "Cinema", "amount": 219.5, "person": "João", "date": "2026-09-12T20:00:00Z", "tags": ["Lazer"], "paid": True, "cardId": CARD["id"]},
    ]:
        assert client.post(f"{API}/expenses", json=payload, headers=auth_headers).status_code == 201

    summary = client.get(f"{API}/cards/{CARD['id']}/summary?month=9&year=2026", headers=auth_headers)
    assert summary.status_code == 200
    numbers = summary.json()["data"]
    assert numbers["limit"] == 3000.0
    assert numbers["spent"] == 519.5
    assert numbers["pending"] == 300.0
    assert numbers["paid"] == 219.5
    assert numbers["available"] == 2700.0
    assert numbers["expensesCount"] == 2

    dashboard = client.get(f"{API}/dashboard/summary?month=9&year=2026", headers=auth_headers)
    assert dashboard.status_code == 200
    home = dashboard.json()["data"]
    assert home["totalLimit"] == 3000.0
    assert home["availableLimit"] == 2700.0
    assert home["totalSpent"] == 519.5
    assert home["pending"] == 300.0
    assert home["paid"] == 219.5
    assert home["cards"][0]["card"]["id"] == CARD["id"]
    assert len(home["recentExpenses"]) == 2

    archived = client.patch(f"{API}/cards/{CARD['id']}", json={"isArchived": True}, headers=auth_headers)
    assert archived.json()["data"]["isArchived"] is True
    assert client.get(f"{API}/cards", headers=auth_headers).json()["data"] == []
    assert len(client.get(f"{API}/cards?includeArchived=true", headers=auth_headers).json()["data"]) == 1

    deleted = client.delete(f"{API}/cards/{CARD['id']}", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["data"]["detachedExpenses"] == 2
    assert client.get(f"{API}/cards/{CARD['id']}", headers=auth_headers).status_code == 404

    # Expenses survive the card removal with cardId = null (no cascade delete).
    expenses = client.get(f"{API}/expenses?month=9&year=2026", headers=auth_headers).json()["data"]["items"]
    assert len(expenses) == 2
    assert all(item["cardId"] is None for item in expenses)


def test_card_type_accepts_portuguese_labels(client, auth_headers):
    for label, expected in (("Crédito", "Credit"), ("débito", "Debit"), ("credito", "Credit"), ("DEBIT", "Debit")):
        payload = {key: value for key, value in CARD.items() if key != "id"} | {"type": label}
        created = client.post(f"{API}/cards", json=payload, headers=auth_headers)
        assert created.status_code == 201, created.text
        assert created.json()["data"]["type"] == expected
    patched = client.patch(f"{API}/cards/{created.json()['data']['id']}", json={"type": "Crédito"}, headers=auth_headers)
    assert patched.json()["data"]["type"] == "Credit"
    assert client.post(f"{API}/cards", json={**CARD, "id": None, "type": "Prepaid"}, headers=auth_headers).status_code == 422


def test_card_validation_rules(client, auth_headers):
    invalid = client.post(f"{API}/cards", json={**CARD, "id": None, "lastDigits": "12345", "expiryDate": "13/28", "colorAccent": "red"}, headers=auth_headers)
    assert invalid.status_code == 422
    fields = {item["field"] for item in invalid.json()["error"]["details"]}
    assert {"lastDigits", "expiryDate", "colorAccent"} <= fields


def test_expense_with_unknown_card_is_rejected(client, auth_headers):
    response = client.post(f"{API}/expenses", json={"description": "x", "amount": 1, "person": "a", "date": "2026-09-01", "cardId": "missing"}, headers=auth_headers)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "cardId"


def test_cards_are_isolated_between_users(client, auth_headers):
    from tests.conftest import bearer, register

    other = bearer(register(client))
    client.post(f"{API}/cards", json=CARD, headers=auth_headers)
    assert client.get(f"{API}/cards/{CARD['id']}", headers=other).status_code == 404
    assert client.post(f"{API}/cards", json=CARD, headers=other).status_code == 409
