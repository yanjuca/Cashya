from collections import defaultdict
from typing import Any


def predict_spending(transactions: list[Any]) -> dict[str, Any]:
	monthly: dict[str, float] = defaultdict(float)
	for transaction in transactions:
		transaction_date = transaction.get("date") if isinstance(transaction, dict) else getattr(transaction, "date", None)
		if transaction_date:
			amount = transaction.get("amount", 0) if isinstance(transaction, dict) else getattr(transaction, "amount", 0)
			monthly[transaction_date.strftime("%Y-%m")] += float(amount or 0)
	if not monthly:
		return {"status": "insufficient_data", "monthly_average": 0, "next_month_prediction": 0, "confidence": 0, "trend": "unknown", "history": []}
	history = sorted(monthly.items())
	values = [value for _, value in history]
	recent = values[-3:]
	weights = list(range(1, len(recent) + 1))
	weighted_average = sum(value * weight for value, weight in zip(recent, weights)) / sum(weights)
	trend_delta = values[-1] - values[-2] if len(values) > 1 else 0
	threshold = max(values[-1] * 0.05, 1)
	trend = "increasing" if trend_delta > threshold else "decreasing" if trend_delta < -threshold else "stable"
	volatility = max(values) - min(values) if len(values) > 1 else 0
	confidence = max(35, min(95, round(90 - (volatility / max(sum(values), 1)) * 100)))
	return {"status": "ok", "monthly_average": round(sum(values) / len(values), 2), "next_month_prediction": round(max(0, weighted_average + trend_delta * 0.25), 2), "confidence": confidence, "trend": trend, "trend_delta": round(trend_delta, 2), "months_used": len(values), "history": [{"month": month, "total": round(value, 2)} for month, value in history], "method": "weighted_recent_average_with_trend"}


__all__ = ["predict_spending"]
