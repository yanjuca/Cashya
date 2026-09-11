from datetime import date, timedelta
from random import Random


def sample_transactions(count: int = 12, seed: int = 42, reference_date: date | None = None) -> list[dict]:
    generator = Random(seed)
    today = reference_date or date.today()
    templates = [("Groceries", "food", 25, 120), ("Bus ticket", "transport", 3, 25), ("Restaurant", "food", 20, 90), ("Streaming", "subscriptions", 8, 25), ("Pharmacy", "health", 10, 80), ("Coffee", "leisure", 4, 20)]
    transactions = []
    for index in range(max(0, count)):
        description, tag, minimum, maximum = templates[index % len(templates)]
        transactions.append({"description": description, "amount": round(generator.uniform(minimum, maximum), 2), "person": generator.choice(["Me", "Partner", "Family"]), "date": today - timedelta(days=generator.randint(0, 150)), "tags": [tag], "paid": generator.random() > 0.25})
    return sorted(transactions, key=lambda item: item["date"])
