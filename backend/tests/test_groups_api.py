from tests.conftest import API, bearer, register


def test_shared_expenses_in_groups(client):
    owner_auth = register(client, email="owner@example.com", name="Owner")
    member_auth = register(client, email="member@example.com", name="Member")
    outsider_auth = register(client, email="outsider@example.com", name="Outsider")
    owner, member, outsider = bearer(owner_auth), bearer(member_auth), bearer(outsider_auth)

    created = client.post(f"{API}/groups", json={"name": "Casa"}, headers=owner)
    assert created.status_code == 201, created.text
    group = created.json()["data"]
    assert group["members"][0]["role"] == "owner"
    group_id = group["id"]

    assert client.post(f"{API}/groups/{group_id}/members", json={"email": "nobody@example.com"}, headers=owner).status_code == 404
    assert client.post(f"{API}/groups/{group_id}/members", json={"email": "member@example.com"}, headers=member).status_code == 404
    added = client.post(f"{API}/groups/{group_id}/members", json={"email": "member@example.com"}, headers=owner)
    assert added.status_code == 201
    assert {item["email"] for item in added.json()["data"]["members"]} == {"owner@example.com", "member@example.com"}
    assert client.post(f"{API}/groups/{group_id}/members", json={"email": "member@example.com"}, headers=owner).status_code == 409

    # Outsiders cannot post into the group.
    denied = client.post(f"{API}/expenses", json={"description": "Aluguel", "amount": 1500, "person": "Owner", "date": "2026-09-05", "groupId": group_id}, headers=outsider)
    assert denied.status_code == 422

    rent = client.post(f"{API}/expenses", json={"description": "Aluguel", "amount": 1500, "person": "Owner", "date": "2026-09-05", "groupId": group_id}, headers=owner)
    assert rent.status_code == 201
    rent_id = rent.json()["data"]["id"]
    groceries = client.post(f"{API}/expenses", json={"description": "Mercado", "amount": 300, "person": "Member", "date": "2026-09-06", "groupId": group_id, "paid": True}, headers=member)
    assert groceries.status_code == 201

    # Both members see both expenses; the outsider sees nothing.
    assert client.get(f"{API}/expenses?groupId={group_id}", headers=owner).json()["data"]["pagination"]["total"] == 2
    assert client.get(f"{API}/expenses", headers=member).json()["data"]["pagination"]["total"] == 2
    assert client.get(f"{API}/expenses", headers=outsider).json()["data"]["pagination"]["total"] == 0
    assert client.get(f"{API}/expenses/{rent_id}", headers=member).status_code == 200
    assert client.get(f"{API}/expenses/{rent_id}", headers=outsider).status_code == 404

    balance = client.get(f"{API}/groups/{group_id}/balance", headers=member).json()["data"]
    assert balance["total"] == 1800.0
    assert balance["pending"] == 1500.0
    assert balance["perPerson"][0] == {"person": "Owner", "total": 1500.0, "pending": 1500.0, "paid": 0.0, "count": 1}

    listed = client.get(f"{API}/groups/{group_id}/expenses?status=paid", headers=owner).json()["data"]
    assert listed["pagination"]["total"] == 1

    assert client.get(f"{API}/groups", headers=member).json()["data"][0]["name"] == "Casa"
    assert client.patch(f"{API}/groups/{group_id}", json={"name": "Apartamento"}, headers=member).status_code == 403
    assert client.patch(f"{API}/groups/{group_id}", json={"name": "Apartamento"}, headers=owner).json()["data"]["name"] == "Apartamento"

    # A member leaves: their group expenses become personal and disappear from the group.
    assert client.delete(f"{API}/groups/{group_id}/members/{member_auth['user']['id']}", headers=member).status_code == 200
    assert client.get(f"{API}/expenses", headers=member).json()["data"]["pagination"]["total"] == 1
    assert client.get(f"{API}/expenses?groupId={group_id}", headers=owner).json()["data"]["pagination"]["total"] == 1

    assert client.delete(f"{API}/groups/{group_id}", headers=owner).status_code == 200
    assert client.get(f"{API}/groups/{group_id}", headers=owner).status_code == 404
    assert client.get(f"{API}/expenses/{rent_id}", headers=owner).json()["data"]["groupId"] is None
