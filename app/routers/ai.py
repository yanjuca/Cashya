from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.transaction import Transaction
from app.models.user import User
from app.services.ai import analyze_spending, predict_spending, recommend_savings

router = APIRouter()


def user_transactions(db: Session, user: User) -> list[Transaction]:
    return list(db.scalars(select(Transaction).where(Transaction.user_id == user.id, Transaction.deleted_at.is_(None))))


@router.get("/analysis")
def analysis(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return analyze_spending(user_transactions(db, user))


@router.get("/prediction")
def prediction(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return predict_spending(user_transactions(db, user))


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return recommend_savings(user_transactions(db, user))
