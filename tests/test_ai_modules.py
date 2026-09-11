from datetime import date

from ai.synthetic import sample_transactions
from ai.analyzer import analyze_transactions
from ai.predictor import predict_spending
from ai.recommender import recommend_savings


def test_ai_modules_accept_synthetic_data():
    transactions = sample_transactions(count=24, seed=7, reference_date=date(2026, 9, 6))
    assert len(transactions) == 24
    assert analyze_transactions(transactions)["metrics"]["count"] == 24
    assert predict_spending(transactions)["history"]
    assert recommend_savings(transactions)["recommendations"]


def test_ai_modules_report_insufficient_data():
    assert analyze_transactions([])["status"] == "insufficient_data"
    assert predict_spending([])["confidence"] == 0
    assert recommend_savings([])["recommendations"] == []