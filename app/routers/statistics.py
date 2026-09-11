from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.statistics import StatisticsRead
from app.services.statistics import build_statistics

router = APIRouter()


@router.get("", response_model=StatisticsRead)
def get_statistics(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> StatisticsRead:
    transactions = list(db.scalars(select(Transaction).where(Transaction.user_id == user.id, Transaction.deleted_at.is_(None))))
    return build_statistics(transactions)
