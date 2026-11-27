from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.expense import Expense
from app.models.user import User
from app.schemas.card import CardRead
from app.schemas.dashboard import DashboardSummary, WalletCard
from app.schemas.expenses import ExpenseRead
from app.services.cards import card_summary, list_cards
from app.services.expenses import month_bounds, month_key, visible_expenses

router = APIRouter()
ZERO = Decimal("0")


@router.get("/summary", summary="Wallet + home screen numbers in one call")
def dashboard_summary(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2200),
    recent: int = Query(default=5, ge=0, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    today = date.today()
    month = month or today.month
    year = year or today.year
    start, end = month_bounds(year, month)

    expenses = list(db.scalars(visible_expenses(db, user).where(Expense.date >= start, Expense.date <= end).order_by(Expense.date.desc(), Expense.created_at.desc())))
    total_spent = sum((item.amount for item in expenses), ZERO)
    paid = sum((item.amount for item in expenses if item.paid), ZERO)

    wallet: list[WalletCard] = []
    total_limit = ZERO
    available_limit = ZERO
    for card in list_cards(db, user):
        summary = card_summary(db, card, year, month)
        total_limit += card.limit
        available_limit += summary.available
        wallet.append(WalletCard(card=CardRead.model_validate(card), summary=summary))

    usage = float(total_spent / total_limit * 100) if total_limit > ZERO else 0.0
    data = DashboardSummary(
        month=month_key(year, month),
        total_limit=total_limit,
        available_limit=available_limit,
        total_spent=total_spent,
        pending=total_spent - paid,
        paid=paid,
        usage_percent=round(usage, 2),
        expenses_count=len(expenses),
        cards=wallet,
        recent_expenses=[ExpenseRead.model_validate(item) for item in expenses[:recent]],
    )
    return envelope(data)
