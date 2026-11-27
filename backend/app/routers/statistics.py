from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.expense import Expense
from app.models.user import User
from app.schemas.statistics import StatisticsRead
from app.services.expenses import visible_expenses
from app.services.statistics import build_statistics

router = APIRouter()


@router.get("", response_model=StatisticsRead, summary="Totals by person, tag and month")
def get_statistics(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> StatisticsRead:
    expenses: list[Expense] = list(db.scalars(visible_expenses(db, user)))
    return build_statistics(expenses)
