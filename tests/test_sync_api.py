from datetime import datetime, timedelta, timezone
from uuid import uuid4

from tests.conftest import API


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def test_sync_batch_applies_mutations_and_returns_server_changes(client, auth_headers):
    CARD_ID, EXPENSE_ID = str(uuid4()), str(uuid4())
    first = client.post(
        f"{API}/sync/batch",
        json={
            "lastSyncTimestamp": None,
            "mutations": [
                {"type": "CREATE_CARD", "data": {"id": CARD_ID, "holderName": "NUBANK", "brand": "mastercard", "type": "Credit", "lastDigits": "4321", "expiryDate": "05/30", "limit": 5000}},
                {"type": "CREATE_EXPENSE", "data": {"id": EXPENSE_ID, "description": "Jantar", "amount": 185.5, "person": "Carlos", "date": "2026-09-21T20:30:00Z", "tags": ["Lazer"], "paid": False, "cardId": CARD_ID}},
                {"type": "CREATE_EXPENSE", "data": {"description": "Sem id", "amount": 10, "person": "Ana", "date": "2026-09-20"}},
                {"type": "UPDATE_EXPENSE", "id": "does-not-exist", "data": {"amount": 1}},
                {"type": "CREATE_EXPENSE", "data": {"description": "Invalido", "amount": -5, "person": "Ana", "date": "2026-09-20"}},
            ],
        },
        headers=auth_headers,
    )
    assert first.status_code == 200, first.text
    data = first.json()["data"]
    assert data["syncedAt"].endswith("Z")
    assert [item["type"] for item in data["applied"]] == ["CREATE_CARD", "CREATE_EXPENSE", "CREATE_EXPENSE"]
    assert [item["reason"] for item in data["conflicts"]] == ["expense not found", "validation failed: amount: Input should be greater than 0"]
    assert len(data["serverChanges"]["expenses"]) == 2
    assert data["serverChanges"]["cards"][0]["id"] == CARD_ID
    synced_at = data["syncedAt"]

    # Nothing changed since the last sync -> empty delta.
    empty = client.post(f"{API}/sync/batch", json={"lastSyncTimestamp": synced_at, "mutations": []}, headers=auth_headers).json()["data"]
    assert empty["serverChanges"] == {"expenses": [], "cards": []}

    second = client.post(
        f"{API}/sync/batch",
        json={
            "lastSyncTimestamp": synced_at,
            "mutations": [
                {"type": "TOGGLE_PAID", "id": EXPENSE_ID},
                {"type": "UPDATE_CARD", "id": CARD_ID, "data": {"limit": 6000}},
                {"type": "DELETE_CARD", "id": CARD_ID},
            ],
        },
        headers=auth_headers,
    )
    changes = second.json()["data"]["serverChanges"]
    assert second.json()["data"]["conflicts"] == []
    updated_expense = next(item for item in changes["expenses"] if item["id"] == EXPENSE_ID)
    assert updated_expense["paid"] is True
    assert updated_expense["cardId"] is None  # detached by DELETE_CARD
    assert changes["cards"][0]["deletedAt"] is not None

    third = client.post(f"{API}/sync/batch", json={"lastSyncTimestamp": synced_at, "mutations": [{"type": "DELETE_EXPENSE", "id": EXPENSE_ID}]}, headers=auth_headers).json()["data"]
    assert third["applied"] == [{"type": "DELETE_EXPENSE", "id": EXPENSE_ID}]
    assert next(item for item in third["serverChanges"]["expenses"] if item["id"] == EXPENSE_ID)["deletedAt"] is not None


def test_sync_last_write_wins_conflicts(client, auth_headers):
    EXPENSE_ID = str(uuid4())
    created = client.post(f"{API}/expenses", json={"id": EXPENSE_ID, "description": "Server", "amount": 50, "person": "Yan", "date": "2026-09-01"}, headers=auth_headers).json()["data"]
    server_updated_at = datetime.fromisoformat(created["updatedAt"].replace("Z", "+00:00"))

    stale = client.post(
        f"{API}/sync/batch",
        json={"mutations": [{"type": "UPDATE_EXPENSE", "id": EXPENSE_ID, "data": {"description": "Stale"}, "clientUpdatedAt": iso(server_updated_at - timedelta(minutes=5))}]},
        headers=auth_headers,
    ).json()["data"]
    assert stale["applied"] == []
    assert stale["conflicts"][0]["reason"] == "server version is newer"
    assert stale["conflicts"][0]["server"]["description"] == "Server"

    fresh = client.post(
        f"{API}/sync/batch",
        json={"mutations": [{"type": "UPDATE_EXPENSE", "id": EXPENSE_ID, "data": {"description": "Fresh"}, "clientUpdatedAt": iso(server_updated_at + timedelta(minutes=5))}]},
        headers=auth_headers,
    ).json()["data"]
    assert fresh["conflicts"] == []
    assert client.get(f"{API}/expenses/{EXPENSE_ID}", headers=auth_headers).json()["data"]["description"] == "Fresh"

    client.delete(f"{API}/expenses/{EXPENSE_ID}", headers=auth_headers)
    after_delete = client.post(f"{API}/sync/batch", json={"mutations": [{"type": "UPDATE_EXPENSE", "id": EXPENSE_ID, "data": {"description": "Ghost"}}]}, headers=auth_headers).json()["data"]
    assert after_delete["conflicts"][0]["reason"] == "expense was deleted on the server"


def test_import_and_export_backup(client, auth_headers):
    CARD_ID, EXPENSE_ID, OTHER_ID = str(uuid4()), str(uuid4()), str(uuid4())
    backup = {
        "version": "1.0.0",
        "exportedAt": "2026-09-21T13:30:00.000Z",
        "cards": [{"id": CARD_ID, "holderName": "MAIN WALLET", "brand": "visa", "type": "Credit", "lastDigits": "1234", "expiryDate": "12/28", "limit": 3000, "colorAccent": "#ff453a"}],
        "expenses": [
            {"id": EXPENSE_ID, "description": "Mercado", "amount": 120.4, "person": "Yan", "date": "2026-09-10T12:00:00.000Z", "tags": ["Mercado"], "paid": False, "cardId": CARD_ID},
            {"id": OTHER_ID, "description": "Uber", "amount": 25, "person": "Yan", "date": "2026-09-11T12:00:00.000Z", "tags": [], "paid": True, "cardId": "unknown-card"},
        ],
    }
    imported = client.post(f"{API}/sync/import-backup", json=backup, headers=auth_headers)
    assert imported.status_code == 200, imported.text
    result = imported.json()["data"]
    assert result == {"cardsCreated": 1, "cardsUpdated": 0, "expensesCreated": 2, "expensesUpdated": 0, "warnings": [{"type": "expense", "id": OTHER_ID, "reason": "card not found; cardId cleared"}]}

    again = client.post(f"{API}/sync/import-backup", json=backup, headers=auth_headers).json()["data"]
    assert (again["cardsUpdated"], again["expensesUpdated"]) == (1, 2)

    expenses = client.get(f"{API}/expenses", headers=auth_headers).json()["data"]["items"]
    assert {item["source"] for item in expenses} == {"import"}

    exported = client.get(f"{API}/sync/export-backup", headers=auth_headers).json()["data"]
    assert exported["version"] == "1.0.0"
    assert exported["exportedAt"].endswith("Z")
    assert [card["id"] for card in exported["cards"]] == [CARD_ID]
    assert {item["id"] for item in exported["expenses"]} == {EXPENSE_ID, OTHER_ID}


def test_backup_keeps_recurrence_and_portuguese_card_type(client, auth_headers):
    CARD_ID, ORIGIN_ID = str(uuid4()), f"o{uuid4().hex[:20]}"
    COPY_ID = f"{ORIGIN_ID}-r-2026-10"
    backup = {
        "version": "1.0.0",
        "exportedAt": "2026-09-21T13:30:00.000Z",
        "cards": [{"id": CARD_ID, "holderName": "NUBANK", "brand": "elo", "type": "Débito", "lastDigits": "9876", "expiryDate": "01/30", "limit": 0}],
        "expenses": [
            {"id": ORIGIN_ID, "description": "Aluguel", "amount": 1500, "person": "Yan", "date": "2026-09-05T12:00:00.000Z", "tags": ["Casa"], "paid": True, "recurring": True, "recurringMonths": 12, "skippedMonths": ["2026-12"]},
            {"id": COPY_ID, "description": "Aluguel", "amount": 1500, "person": "Yan", "date": "2026-10-05T12:00:00.000Z", "tags": ["Casa"], "paid": False, "recurring": False, "recurringSourceId": ORIGIN_ID},
        ],
    }
    assert client.post(f"{API}/sync/import-backup", json=backup, headers=auth_headers).status_code == 200

    exported = client.get(f"{API}/sync/export-backup", headers=auth_headers).json()["data"]
    assert exported["cards"][0]["type"] == "Debit"
    by_id = {item["id"]: item for item in exported["expenses"]}
    assert (by_id[ORIGIN_ID]["recurring"], by_id[ORIGIN_ID]["recurringMonths"], by_id[ORIGIN_ID]["skippedMonths"]) == (True, 12, ["2026-12"])
    assert by_id[COPY_ID]["recurringSourceId"] == ORIGIN_ID


def test_sync_batch_carries_recurring_fields(client, auth_headers):
    origin_id = f"o{uuid4().hex[:20]}"
    mutations = [
        {"type": "CREATE_EXPENSE", "data": {"id": origin_id, "description": "Academia", "amount": 99.9, "person": "Yan", "date": "2026-09-01T10:00:00.000Z", "recurring": True, "recurringMonths": 0}},
        {"type": "UPDATE_EXPENSE", "id": origin_id, "data": {"skippedMonths": ["2026-10"]}},
    ]
    result = client.post(f"{API}/sync/batch", json={"lastSyncTimestamp": None, "mutations": mutations}, headers=auth_headers).json()["data"]
    assert result["conflicts"] == []
    synced = next(item for item in result["serverChanges"]["expenses"] if item["id"] == origin_id)
    assert (synced["recurring"], synced["recurringMonths"], synced["skippedMonths"]) == (True, 0, ["2026-10"])
