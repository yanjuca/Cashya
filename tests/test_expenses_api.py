from uuid import uuid4

from tests.conftest import API

EXPENSE = {
    "id": "e4a2c5b0-1234-4567-89ab-cdef01234567",
    "description": "Supermercado",
    "amount": 250.75,
    "person": "Yan",
    "date": "2026-09-09",
    "tags": ["Alimentacao", "Mercado"],
    "paid": False,
    "source": "manual",
}


def test_recurring_fields_round_trip(client, auth_headers):
    origin_id = f"origin-{uuid4().hex[:12]}"
    origin = {**EXPENSE, "id": origin_id, "recurring": True, "recurringMonths": 6, "skippedMonths": ["2026-11", "2026-1", "2026-11"]}
    created = client.post(f"{API}/expenses", json=origin, headers=auth_headers)
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    assert (data["recurring"], data["recurringMonths"], data["recurringSourceId"]) == (True, 6, None)
    assert data["skippedMonths"] == ["2026-11", "2026-1"]

    copy_id = f"{origin_id}-r-2026-10"
    copy = client.post(f"{API}/expenses", json={**EXPENSE, "id": copy_id, "date": "2026-10-09T00:00:00.000Z", "recurringSourceId": origin_id}, headers=auth_headers)
    assert copy.status_code == 201, copy.text
    assert (copy.json()["data"]["recurring"], copy.json()["data"]["recurringSourceId"]) == (False, origin_id)

    # Stopping the series from the app: the copy loses its link (null) and the origin stops repeating.
    detached = client.patch(f"{API}/expenses/{copy_id}", json={"recurringSourceId": None}, headers=auth_headers)
    assert detached.json()["data"]["recurringSourceId"] is None
    stopped = client.patch(f"{API}/expenses/{origin_id}", json={"recurring": None, "skippedMonths": None}, headers=auth_headers)
    assert stopped.status_code == 200, stopped.text
    assert (stopped.json()["data"]["recurring"], stopped.json()["data"]["skippedMonths"]) == (False, [])

    listed = {item["id"]: item for item in client.get(f"{API}/expenses", headers=auth_headers).json()["data"]["items"]}
    assert listed[origin_id]["recurringMonths"] == 6

    plain = client.post(f"{API}/expenses", json={**EXPENSE, "id": None}, headers=auth_headers).json()["data"]
    assert (plain["recurring"], plain["recurringMonths"], plain["skippedMonths"]) == (False, None, [])


def test_recurring_fields_are_validated(client, auth_headers):
    for bad in ({"recurringMonths": 121}, {"recurringMonths": -1}, {"skippedMonths": ["2026-13"]}, {"skippedMonths": ["2026-01"]}, {"skippedMonths": ["nov"]}):
        response = client.post(f"{API}/expenses", json={**EXPENSE, "id": None, **bad}, headers=auth_headers)
        assert response.status_code == 422, (bad, response.text)


def test_expenses_contract_filters_reports_and_soft_delete(client, auth_headers):
    created = client.post(f"{API}/expenses", json=EXPENSE, headers=auth_headers)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["success"] is True
    assert body["data"]["id"] == EXPENSE["id"]
    assert body["data"]["amount"] == 250.75
    assert body["data"]["cardId"] is None
    assert body["data"]["groupId"] is None
    assert body["data"]["createdAt"].endswith("Z")
    assert body["data"]["date"] == "2026-09-09T00:00:00.000Z"

    other = client.post(f"{API}/expenses", json={"description": "Jantar Outback", "amount": 185.5, "person": "Carlos", "date": "2026-09-21T20:30:00Z", "tags": ["Alimentação", "Lazer"], "paid": True}, headers=auth_headers)
    assert other.status_code == 201

    listed = client.get(f"{API}/expenses?month=9&year=2026&tag=Mercado", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["data"]["pagination"] == {"page": 1, "limit": 50, "total": 1, "totalPages": 1, "hasNext": False}

    assert client.get(f"{API}/expenses?searchText=outback", headers=auth_headers).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?person=carlos", headers=auth_headers).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?status=pending", headers=auth_headers).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?status=paid", headers=auth_headers).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?startDate=2026-09-10T00:00:00Z&endDate=2026-09-30T00:00:00Z", headers=auth_headers).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?date=2026-09-09", headers=auth_headers).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?limit=1&page=2", headers=auth_headers).json()["data"]["pagination"]["hasNext"] is False

    summary = client.get(f"{API}/expenses/summary?month=9&year=2026", headers=auth_headers)
    assert summary.json()["data"]["pending"] == 250.75
    assert summary.json()["data"]["paid"] == 185.5
    assert summary.json()["data"]["count"] == 2

    calendar = client.get(f"{API}/expenses/calendar?month=9&year=2026", headers=auth_headers)
    assert calendar.status_code == 200
    days = calendar.json()["data"]["days"]
    assert [day["date"] for day in days] == ["2026-09-09", "2026-09-21"]
    assert days[0]["pending"] == 250.75
    assert days[1]["paid"] == 185.5

    by_person = client.get(f"{API}/expenses/by-person?month=9&year=2026", headers=auth_headers).json()["data"]
    assert by_person[0]["name"] == "Yan"
    assert client.get(f"{API}/expenses/by-tag?month=9&year=2026", headers=auth_headers).status_code == 200
    assert client.get(f"{API}/expenses/monthly-trend?months=3", headers=auth_headers).status_code == 200

    toggled = client.patch(f"{API}/expenses/{EXPENSE['id']}/toggle-paid", headers=auth_headers)
    assert toggled.json()["data"]["paid"] is True

    patched = client.patch(f"{API}/expenses/{EXPENSE['id']}", json={"amount": 300, "tags": ["Mercado", " mercado ", "Casa"]}, headers=auth_headers)
    assert patched.status_code == 200
    assert patched.json()["data"]["amount"] == 300.0
    assert patched.json()["data"]["tags"] == ["Mercado", "Casa"]
    assert patched.json()["data"]["description"] == "Supermercado"

    replaced = client.put(f"{API}/expenses/{EXPENSE['id']}", json={**EXPENSE, "description": "Mercado do mês"}, headers=auth_headers)
    assert replaced.status_code == 200
    assert replaced.json()["data"]["description"] == "Mercado do mês"
    assert replaced.json()["data"]["paid"] is False

    deleted = client.delete(f"{API}/expenses/{EXPENSE['id']}", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["data"]["deletedAt"]
    assert client.get(f"{API}/expenses/{EXPENSE['id']}", headers=auth_headers).status_code == 404

    # Delta sync: `since` also returns soft-deleted rows so other devices can drop them.
    delta = client.get(f"{API}/expenses?since=2026-01-01T00:00:00Z", headers=auth_headers).json()["data"]["items"]
    deleted_item = next(item for item in delta if item["id"] == EXPENSE["id"])
    assert deleted_item["deletedAt"] is not None


def test_amount_must_be_positive(client, auth_headers):
    response = client.post(f"{API}/expenses", json={**EXPENSE, "id": None, "amount": 0}, headers=auth_headers)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "amount"


def test_create_with_same_client_id_is_idempotent(client, auth_headers):
    payload = {**EXPENSE, "id": "e4a2c5b0-1234-4567-89ab-cdef0123ffff"}
    assert client.post(f"{API}/expenses", json=payload, headers=auth_headers).status_code == 201
    again = client.post(f"{API}/expenses", json={**payload, "description": "Retry"}, headers=auth_headers)
    assert again.status_code == 201
    assert again.json()["data"]["description"] == "Retry"
    assert client.get(f"{API}/expenses", headers=auth_headers).json()["data"]["pagination"]["total"] == 1


def test_inbox_confirm_creates_notification_expense(client, auth_headers):
    assert client.get(f"{API}/inbox", headers=auth_headers).json()["data"] == []
    queued = client.post(f"{API}/inbox", json={"description": "Compra aprovada", "amount": 42.9, "date": "2026-09-15T10:00:00Z", "institution": "Nubank", "rawText": "Compra aprovada R$ 42,90"}, headers=auth_headers)
    assert queued.status_code == 201
    pending_id = queued.json()["data"]["id"]
    assert queued.json()["data"]["rawText"].startswith("Compra")

    confirmed = client.post(f"{API}/inbox/{pending_id}/confirm", json={"description": "Padaria", "person": "Yan", "tags": ["Alimentacao"]}, headers=auth_headers)
    assert confirmed.status_code == 200
    assert confirmed.json()["data"]["source"] == "notification"
    assert confirmed.json()["data"]["amount"] == 42.9
    assert client.get(f"{API}/inbox", headers=auth_headers).json()["data"] == []

    queued_again = client.post(f"{API}/inbox", json={"description": "x", "amount": 1, "date": "2026-09-15"}, headers=auth_headers).json()["data"]["id"]
    assert client.delete(f"{API}/inbox/{queued_again}", headers=auth_headers).status_code == 200
