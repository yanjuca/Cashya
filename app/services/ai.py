from typing import Any

from ai.analyzer import analyze_transactions
from ai.predictor import predict_spending as predict_transactions
from ai.recommender import recommend_savings as recommend_transaction_savings


def analyze_spending(transactions: list[Any]) -> dict:
    return analyze_transactions(transactions)


def predict_spending(transactions: list[Any]) -> dict:
    return predict_transactions(transactions)


def recommend_savings(transactions: list[Any]) -> dict:
    return recommend_transaction_savings(transactions)
