from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.expense import Expense
from app.models.user import User
from app.schemas.card import CardCreate, CardPatch, CardSummary, CardUpdate
from app.services.expenses import month_bounds

ZERO = Decimal("0")


def list_cards(db: Session, user: User, include_archived: bool = False, include_deleted: bool = False) -> list[Card]:
    query = select(Card).where(Card.user_id == user.id)
    if not include_deleted:
        query = query.where(Card.deleted_at.is_(None))
    if not include_archived:
        query = query.where(Card.is_archived.is_(False))
    return list(db.scalars(query.order_by(Card.created_at.asc())))


def get_owned_card(db: Session, user: User, card_id: str, include_deleted: bool = False) -> Card:
    query = select(Card).where(Card.id == card_id, Card.user_id == user.id)
    if not include_deleted:
        query = query.where(Card.deleted_at.is_(None))
    card = db.scalar(query)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return card


def create_card(db: Session, user: User, data: CardCreate) -> Card:
    values = data.model_dump()
    card_id = values.pop("id")
    card = db.get(Card, card_id) if card_id else None
    if card is not None:
        if card.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Card ID already belongs to another user")
        for key, value in values.items():
            setattr(card, key, value)
        card.deleted_at = None
    else:
        card = Card(id=card_id, user_id=user.id, **values)
        db.add(card)
    db.commit()
    db.refresh(card)
    return card


def replace_card(db: Session, card: Card, data: CardUpdate) -> Card:
    for key, value in data.model_dump().items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card


def patch_card(db: Session, card: Card, data: CardPatch) -> Card:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card


def soft_delete_card(db: Session, card: Card) -> int:
    """Soft delete the card and detach its expenses (card_id -> NULL) instead of cascading deletes."""
    now = datetime.now(timezone.utc)
    result = db.execute(update(Expense).where(Expense.card_id == card.id).values(card_id=None, updated_at=now))
    card.deleted_at = now
    card.is_archived = True
    db.commit()
    return result.rowcount or 0


def card_summary(db: Session, card: Card, year: int | None = None, month: int | None = None) -> CardSummary:
    """Spent = expenses charged to the card in the period; available = limit minus everything still unpaid."""
    query = select(Expense).where(Expense.card_id == card.id, Expense.deleted_at.is_(None))
    if year and month:
        start, end = month_bounds(year, month)
        query = query.where(Expense.date >= start, Expense.date <= end)
    expenses = list(db.scalars(query))
    spent = sum((item.amount for item in expenses), ZERO)
    paid = sum((item.amount for item in expenses if item.paid), ZERO)
    pending = spent - paid
    unpaid_total = db.scalar(select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.card_id == card.id, Expense.deleted_at.is_(None), Expense.paid.is_(False))) or ZERO
    unpaid_total = Decimal(str(unpaid_total))
    available = max(card.limit - unpaid_total, ZERO) if card.type == "Credit" else max(card.limit - spent, ZERO)
    usage = float(spent / card.limit * 100) if card.limit > ZERO else 0.0
    return CardSummary(card_id=card.id, limit=card.limit, spent=spent, pending=pending, paid=paid, available=available, usage_percent=round(usage, 2), expenses_count=len(expenses))
