from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.transaction import create_transaction, list_transactions, update_transaction

router = APIRouter()


@router.get("", response_model=list[TransactionRead])
def get_transactions(month: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Transaction]:
    return list_transactions(db, user, month)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def add_transaction(data: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Transaction:
    try:
        return create_transaction(db, user, data)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


def get_owned_transaction(transaction_id: str, db: Session, user: User) -> Transaction:
    transaction = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Transaction:
    return get_owned_transaction(transaction_id, db, user)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def edit_transaction(transaction_id: str, data: TransactionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Transaction:
    transaction = get_owned_transaction(transaction_id, db, user)
    try:
        return update_transaction(db, user, transaction, data)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    transaction = get_owned_transaction(transaction_id, db, user)
    db.delete(transaction)
    db.commit()


@router.post("/{transaction_id}/paid", response_model=TransactionRead)
def toggle_paid(transaction_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Transaction:
    transaction = get_owned_transaction(transaction_id, db, user)
    transaction.paid = not transaction.paid
    db.commit()
    db.refresh(transaction)
    return transaction
