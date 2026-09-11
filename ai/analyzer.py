from collections import defaultdict
from statistics import mean, median
from typing import Any


def _value(transaction: Any, name: str, default: Any = None) -> Any:
	return transaction.get(name, default) if isinstance(transaction, dict) else getattr(transaction, name, default)


def analyze_transactions(transactions: list[Any]) -> dict[str, Any]:
	if not transactions:
		return {"status": "insufficient_data", "message": "Add transactions to receive a personalized spending analysis.", "insights": [], "metrics": {"total": 0, "count": 0, "average": 0, "paid": 0, "pending": 0}, "top_categories": [], "top_people": [], "alerts": []}

	amounts = [float(_value(item, "amount", 0) or 0) for item in transactions]
	total = sum(amounts)
	paid = sum(amount for item, amount in zip(transactions, amounts) if _value(item, "paid", False))
	pending = total - paid
	by_tag: dict[str, float] = defaultdict(float)
	by_person: dict[str, dict[str, float | int]] = defaultdict(lambda: {"total": 0.0, "count": 0, "pending": 0.0})
	by_month: dict[str, float] = defaultdict(float)

	for item, amount in zip(transactions, amounts):
		person = str(_value(item, "person", "Unknown"))
		by_person[person]["total"] += amount
		by_person[person]["count"] += 1
		if not _value(item, "paid", False):
			by_person[person]["pending"] += amount
		for tag in _value(item, "tags", []) or []:
			by_tag[str(tag)] += amount
		transaction_date = _value(item, "date")
		if transaction_date:
			by_month[transaction_date.strftime("%Y-%m")] += amount

	typical_amount = median(amounts)
	alerts = []
	for item, amount in zip(transactions, amounts):
		if amount >= max(typical_amount * 3, 100):
			alerts.append({"type": "unusually_large", "description": _value(item, "description", "Transaction"), "amount": round(amount, 2), "message": "This transaction is much larger than your typical expense."})

	top_category = max(by_tag.items(), key=lambda pair: pair[1], default=(None, 0))
	top_person = max(by_person.items(), key=lambda pair: pair[1]["total"], default=(None, {}))
	insights = [f"You tracked {total:.2f} across {len(transactions)} transactions."]
	if top_category[0]:
		insights.append(f"'{top_category[0]}' represents {top_category[1] / total * 100:.1f}% of your spending.")
	if top_person[0]:
		insights.append(f"{top_person[0]} accounts for {top_person[1]['total'] / total * 100:.1f}% of the total.")
	if pending:
		insights.append(f"There is {pending:.2f} still pending.")
	if alerts:
		insights.append(f"{len(alerts)} unusually large transaction(s) deserve a quick review.")

	return {
		"status": "ok",
		"message": "Spending analysis generated locally from your transaction history.",
		"insights": insights,
		"metrics": {"total": round(total, 2), "count": len(transactions), "average": round(mean(amounts), 2), "median": round(typical_amount, 2), "paid": round(paid, 2), "pending": round(pending, 2), "payment_rate": round(paid / total * 100, 1) if total else 0},
		"top_categories": [{"name": name, "total": round(value, 2), "share": round(value / total * 100, 1)} for name, value in sorted(by_tag.items(), key=lambda pair: pair[1], reverse=True)[:5]],
		"top_people": [{"name": name, **{key: round(value, 2) if isinstance(value, float) else value for key, value in values.items()}} for name, values in sorted(by_person.items(), key=lambda pair: pair[1]["total"], reverse=True)[:5]],
		"monthly_totals": [{"month": month, "total": round(value, 2)} for month, value in sorted(by_month.items())],
		"alerts": alerts,
	}


def analyze_spending(transactions: list[Any]) -> dict[str, Any]:
	return analyze_transactions(transactions)


__all__ = ["analyze_spending", "analyze_transactions"]
