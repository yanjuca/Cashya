from collections import defaultdict

from app.models.expense import Expense
from app.schemas.statistics import GroupTotal, MonthTotal, StatisticsRead, Summary


def build_statistics(transactions: list[Expense]) -> StatisticsRead:
    total = sum(item.amount for item in transactions)
    paid = sum(item.amount for item in transactions if item.paid)
    by_person: dict[str, dict[str, float | int]] = defaultdict(lambda: {"total": 0.0, "pending": 0.0, "count": 0})
    by_tag: dict[str, dict[str, float | int]] = defaultdict(lambda: {"total": 0.0, "pending": 0.0, "count": 0})
    by_month: dict[str, float] = defaultdict(float)

    for item in transactions:
        amount = float(item.amount)
        by_person[item.person]["total"] += amount
        by_person[item.person]["count"] += 1
        if not item.paid:
            by_person[item.person]["pending"] += amount
        for tag in item.tags or []:
            by_tag[tag]["total"] += amount
            by_tag[tag]["count"] += 1
            if not item.paid:
                by_tag[tag]["pending"] += amount
        by_month[item.date.strftime("%Y-%m")] += amount

    return StatisticsRead(
        summary=Summary(total=total, paid=paid, pending=total - paid, count=len(transactions), average=total / len(transactions) if transactions else 0),
        by_person=[GroupTotal(name=name, **values) for name, values in sorted(by_person.items(), key=lambda pair: pair[1]["total"], reverse=True)],
        by_tag=[GroupTotal(name=name, **values) for name, values in sorted(by_tag.items(), key=lambda pair: pair[1]["total"], reverse=True)],
        by_month=[MonthTotal(month=month, total=value) for month, value in sorted(by_month.items(), reverse=True)],
    )
