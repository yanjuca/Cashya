from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.expense import Expense
from app.models.pending_transaction import PendingTransaction
from app.models.user import User
from app.schemas.expenses import ExpenseRead
from app.schemas.inbox import PendingConfirm, PendingCreate, PendingRead
from app.services.expenses import validate_card, validate_group

router = APIRouter()


def owned_pending(db: Session, user: User, pending_id: str) -> PendingTransaction:
    pending = db.scalar(select(PendingTransaction).where(PendingTransaction.id == pending_id, PendingTransaction.user_id == user.id))
    if pending is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending transaction not found")
    return pending


@router.get("", summary="Transactions captured from notifications waiting for confirmation")
def get_inbox(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    items = db.scalars(select(PendingTransaction).where(PendingTransaction.user_id == user.id).order_by(PendingTransaction.created_at.desc()))
    return envelope([PendingRead.model_validate(item) for item in items])


@router.post("", status_code=status.HTTP_201_CREATED, summary="Queue a transaction captured from a notification")
def add_pending(data: PendingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    pending = PendingTransaction(user_id=user.id, **data.model_dump())
    db.add(pending)
    db.commit()
    db.refresh(pending)
    return envelope(PendingRead.model_validate(pending), "Pending transaction queued")


@router.post("/{pending_id}/confirm", summary="Turn a pending transaction into an expense (source = notification)")
def confirm_pending(pending_id: str, data: PendingConfirm, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    pending = owned_pending(db, user, pending_id)
    validate_card(db, user, data.card_id)
    validate_group(db, user, data.group_id)
    expense = Expense(user_id=user.id, description=data.description, amount=pending.amount, person=data.person, date=pending.date, tags=data.tags, paid=data.paid, card_id=data.card_id, group_id=data.group_id, source="notification")
    db.add(expense)
    db.delete(pending)
    db.commit()
    db.refresh(expense)
    return envelope(ExpenseRead.model_validate(expense), "Expense created from pending transaction")


@router.delete("/{pending_id}", summary="Discard a pending transaction")
def delete_pending(pending_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    db.delete(owned_pending(db, user, pending_id))
    db.commit()
    return envelope(message="Pending transaction discarded")
