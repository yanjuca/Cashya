from decimal import Decimal

from app.schemas.card import CardRead, CardSummary
from app.schemas.common import CamelModel
from app.schemas.expenses import ExpenseRead


class WalletCard(CamelModel):
    card: CardRead
    summary: CardSummary


class DashboardSummary(CamelModel):
    """Everything the Home / Wallet screen needs in a single request."""

    month: str
    total_limit: Decimal
    available_limit: Decimal
    total_spent: Decimal
    pending: Decimal
    paid: Decimal
    usage_percent: float
    expenses_count: int
    cards: list[WalletCard]
    recent_expenses: list[ExpenseRead]
