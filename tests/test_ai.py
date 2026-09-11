def test_statistics_and_ai_endpoints(client, auth_headers):
    for payload in [
        {"description": "Food", "amount": 20, "person": "Alex", "date": "2026-09-01", "tags": ["food"], "paid": True},
        {"description": "Transport", "amount": 10, "person": "Alex", "date": "2026-09-02", "tags": ["transport"], "paid": False},
    ]:
        assert client.post("/transactions", json=payload, headers=auth_headers).status_code == 201

    statistics = client.get("/statistics", headers=auth_headers)
    assert statistics.status_code == 200
    assert statistics.json()["summary"]["total"] == 30
    assert statistics.json()["summary"]["pending"] == 10

    analysis = client.get("/ai/analysis", headers=auth_headers)
    assert analysis.status_code == 200
    assert analysinsights"]
    assert analysis.json()is.json()["["metrics"]["total"] == 30
    assert analysis.json()["top_categories"][0]["name"] == "food"

    prediction = client.get("/ai/prediction", headers=auth_headers)
    assert prediction.json()["next_month_prediction"] == 30
    assert prediction.json()["confidence"] > 0

    recommendations = client.get("/ai/recommendations", headers=auth_headers)
    assert recommendations.status_code == 200
    assert recommendations.json()["potential_monthly_saving"] == 3
    assert recommendations.json()["recommendations"][0]["estimated_monthly_saving"] == 2
