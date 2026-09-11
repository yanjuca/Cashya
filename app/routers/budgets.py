from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetRead, BudgetUpdate

router = APIRouter()


def with_spent(budget: Budget, db: Session) -> BudgetRead:
    query = select(Transaction).where(Transaction.user_id == budget.user_id, Transaction.date.between(f"{budget.month}-01", f"{budget.month}-31"))
    if budget.category_id:
        query = query.where(Transaction.category_id == budget.category_id)
    spent = sum(item.amount for item in db.scalars(query))
    result = BudgetRead.model_validate(budget)
    return result.model_copy(update={"spent": spent})


def get_owned_budget(budget_id: str, db: Session, user: User) -> Budget:
    budget = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    if budget is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return budget


@router.get("", response_model=list[BudgetRead])
def get_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[BudgetRead]:
    budgets = db.scalars(select(Budget).where(Budget.user_id == user.id).order_by(Budget.month.desc())).all()
    return [with_spent(budget, db) for budget in budgets]


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def add_budget(data: BudgetCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> BudgetRead:
    budget = Budget(user_id=user.id, **data.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return with_spent(budget, db)


@router.patch("/{budget_id}", response_model=BudgetRead)
def edit_budget(budget_id: str, data: BudgetUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> BudgetRead:
    budget = get_owned_budget(budget_id, db, user)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, key, value)
    db.commit()
    db.refresh(budget)
    return with_spent(budget, db)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    budget = get_owned_budget(budget_id, db, user)
    db.delete(budget)
    db.commit()
