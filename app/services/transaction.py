from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def validate_category(db: Session, user: User, category_id: str | None) -> None:
    if category_id is not None and db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user.id)) is None:
        raise ValueError("Category not found")


def list_transactions(db: Session, user: User, month: str | None = None) -> list[Transaction]:
    query = select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.date.desc(), Transaction.created_at.desc())
    if month:
        year, month_number = (int(value) for value in month.split("-"))
        start = date(year, month_number, 1)
        end = date(year + (month_number == 12), 1 if month_number == 12 else month_number + 1, 1)
        query = query.where(Transaction.date >= start, Transaction.date < end)
    return list(db.scalars(query))


def create_transaction(db: Session, user: User, data: TransactionCreate) -> Transaction:
    validate_category(db, user, data.category_id)
    transaction = Transaction(user_id=user.id, **data.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def update_transaction(db: Session, user: User, transaction: Transaction, data: TransactionUpdate) -> Transaction:
    values = data.model_dump(exclude_unset=True)
    validate_category(db, user, values.get("category_id", transaction.category_id))
    for key, value in values.items():
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    return transaction
