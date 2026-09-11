def test_expenses_contract_filters_reports_and_soft_delete(client, auth_headers):
    payload = {
        "id": "e4a2c5b0-1234-4567-89ab-cdef01234567",
        "description": "Supermercado",
        "amount": 250.75,
        "person": "Yan",
        "date": "2026-09-09",
        "tags": ["Alimentacao", "Mercado"],
        "paid": False,
        "source": "manual",
    }
    created = client.post("/expenses", json=payload, headers=auth_headers)
    assert created.status_code == 201
    assert created.json()["success"] is True
    assert created.json()["data"]["id"] == payload["id"]
    assert created.json()["data"]["amount"] == 250.75
    assert created.json()["data"]["createdAt"].endswith("+00:00") or created.json()["data"]["createdAt"].endswith("Z")

    listed = client.get("/expenses?month=9&year=2026&tag=Mercado", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["data"]["pagination"]["total"] == 1

    summary = client.get("/expenses/summary?month=9&year=2026", headers=auth_headers)
    assert summary.json()["data"]["pending"] == 250.75

    toggled = client.patch(f"/expenses/{payload['id']}/toggle-paid", headers=auth_headers)
    assert toggled.json()["data"]["paid"] is True

    deleted = client.delete(f"/expenses/{payload['id']}", headers=auth_headers)
    assert deleted.status_code == 200
    assert client.get(f"/expenses/{payload['id']}", headers=auth_headers).status_code == 404


def test_expenses_sync_and_inbox(client, auth_headers):
    inbox = client.get("/inbox", headers=auth_headers)
    assert inbox.status_code == 200
    assert inbox.json()["data"] == []

    synced = client.post(
        "/sync",
        json={
            "lastSyncedAt": "2026-09-01T00:00:00Z",
            "created": [
                {
                    "id": "d1c2b3a4-5678-90ab-cdef-1234567890ab",
                    "description": "Cafe",
                    "amount": 25.50,
                    "person": "Yan",
                    "date": "2026-09-09",
                    "tags": ["Alimentacao"],
                    "paid": True,
                    "source": "manual",
                }
            ],
            "updated": [],
            "deletedIds": [],
        },
        headers=auth_headers,
    )
    assert synced.status_code == 200
    assert synced.json()["data"]["pulled"]["createdOrUpdated"]