from collections import defaultdict
from typing import Any


def recommend_savings(transactions: list[Any]) -> dict[str, Any]:
	by_tag: dict[str, float] = defaultdict(float)
	for transaction in transactions:
		amount = transaction.get("amount", 0) if isinstance(transaction, dict) else getattr(transaction, "amount", 0)
		tags = transaction.get("tags", []) if isinstance(transaction, dict) else getattr(transaction, "tags", [])
		for tag in tags or []:
			by_tag[str(tag)] += float(amount or 0)
	if not by_tag:
		return {"status": "insufficient_data", "recommendations": [], "potential_monthly_saving": 0}
	total = sum(by_tag.values())
	recommendations = []
	for tag, amount in sorted(by_tag.items(), key=lambda pair: pair[1], reverse=True)[:5]:
		saving = round(amount * 0.10, 2)
		recommendations.append({"category": tag, "spent": round(amount, 2), "suggested_reduction": 10, "estimated_monthly_saving": saving, "priority": "high" if amount / total >= 0.35 else "medium", "message": f"Try reducing '{tag}' spending by 10%."})
	return {"status": "ok", "recommendations": recommendations, "potential_monthly_saving": round(sum(item["estimated_monthly_saving"] for item in recommendations), 2), "based_on_categories": len(by_tag)}


__all__ = ["recommend_savings"]
