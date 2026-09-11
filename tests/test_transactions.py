def test_transaction_crud_and_paid_toggle(client, auth_headers):
    payload = {"description": "Dinner", "amount": 42.5, "person": "Alex", "date": "2026-09-06", "tags": ["food"], "paid": False}
    created = client.post("/transactions", json=payload, headers=auth_headers)
    assert created.status_code == 201
    transaction_id = created.json()["id"]

    listed = client.get("/transactions", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["description"] == "Dinner"

    updated = client.patch(f"/transactions/{transaction_id}", json={"amount": 50}, headers=auth_headers)
    assert updated.status_code == 200
    assert updated.json()["amount"] == 50

    toggled = client.post(f"/transactions/{transaction_id}/paid", headers=auth_headers)
    assert toggled.status_code == 200
    assert toggled.json()["paid"] is True

    deleted = client.delete(f"/transactions/{transaction_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/transactions/{transaction_id}", headers=auth_headers).status_code == 404
