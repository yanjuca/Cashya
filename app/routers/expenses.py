from calendar import monthrange
from datetime import date, datetime, timezone
from datetime import date as DateType
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.pending_transaction import PendingTransaction
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.expenses import ExpenseCreate, ExpenseRead, ExpenseUpdate

router = APIRouter()
spec_router = APIRouter()


def serialize_data(data: object) -> object:
    if isinstance(data, Decimal):
        return float(data)
    if isinstance(data, datetime):
        value = data if data.tzinfo else data.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(data, BaseModel):
        return serialize_data(data.model_dump(by_alias=True))
    if isinstance(data, Transaction):
        return serialize_data(ExpenseRead.model_validate(data))
    if isinstance(data, PendingTransaction):
        return {
            "id": data.id,
            "description": data.description,
            "amount": data.amount,
            "date": data.date,
            "institution": data.institution,
            "rawText": data.raw_text,
        }
    if isinstance(data, list):
        return [serialize_data(item) for item in data]
    if isinstance(data, dict):
        return {key: serialize_data(value) for key, value in data.items()}
    return data


def envelope(data: object = None, message: str | None = None) -> dict:
    data = serialize_data(data)
    result = {"success": True, "data": data}
    if message is not None:
        result["message"] = message
    return result


def owned_expense(expense_id: str, db: Session, user: User) -> Transaction:
    expense = db.scalar(select(Transaction).where(Transaction.id == expense_id, Transaction.user_id == user.id, Transaction.deleted_at.is_(None)))
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


def apply_date_filters(query, month: int | None, year: int | None, requested_date: date | None, since: datetime | None, until: datetime | None):
    if requested_date:
        query = query.where(Transaction.date == requested_date)
    elif month and year:
        query = query.where(Transaction.date >= date(year, month, 1), Transaction.date <= date(year, month, monthrange(year, month)[1]))
    elif year:
        query = query.where(Transaction.date >= date(year, 1, 1), Transaction.date <= date(year, 12, 31))
    if since:
        query = query.where(Transaction.updated_at >= since)
    if until:
        query = query.where(Transaction.updated_at <= until)
    return query


@router.get("")
def list_expenses(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2200),
    requested_date: date | None = Query(default=None, alias="date"),
    person: str | None = None,
    tag: str | None = None,
    paid: bool | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    query = select(Transaction).where(Transaction.user_id == user.id, Transaction.deleted_at.is_(None))
    query = apply_date_filters(query, month, year, requested_date, since, until)
    if person:
        query = query.where(Transaction.person == person)
    if paid is not None:
        query = query.where(Transaction.paid == paid)
    expenses = list(db.scalars(query.order_by(Transaction.date.desc(), Transaction.created_at.desc())))
    if tag:
        expenses = [expense for expense in expenses if tag in (expense.tags or [])]
    total = len(expenses)
    start = (page - 1) * limit
    return envelope({"items": expenses[start:start + limit], "pagination": {"page": page, "limit": limit, "total": total}})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    values = data.model_dump()
    expense_id = values.pop("id")
    expense = db.scalar(select(Transaction).where(Transaction.id == expense_id)) if expense_id else None
    if expense is not None and expense.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Expense ID already belongs to another user")
    if expense:
        for key, value in values.items():
            setattr(expense, key, value)
        expense.deleted_at = None
    else:
        expense = Transaction(id=expense_id, user_id=user.id, **values)
        db.add(expense)
    db.commit()
    db.refresh(expense)
    return envelope(expense, "Expense created successfully")


@router.get("/summary")
def expense_summary(month: int = Query(ge=1, le=12), year: int = Query(ge=2000, le=2200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expenses = _month_expenses(db, user, month, year)
    total = sum(item.amount for item in expenses)
    paid = sum(item.amount for item in expenses if item.paid)
    return envelope({"total": total, "paid": paid, "pending": total - paid, "count": len(expenses), "average": total / len(expenses) if expenses else 0})


@router.get("/by-person")
def by_person(month: int = Query(ge=1, le=12), year: int = Query(ge=2000, le=2200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    grouped: dict[str, dict] = {}
    for expense in _month_expenses(db, user, month, year):
        item = grouped.setdefault(expense.person, {"name": expense.person, "total": 0, "pending": 0, "count": 0})
        item["total"] += expense.amount
        item["pending"] += 0 if expense.paid else expense.amount
        item["count"] += 1
    return envelope(sorted(grouped.values(), key=lambda item: item["total"], reverse=True))


@router.get("/by-tag")
def by_tag(month: int = Query(ge=1, le=12), year: int = Query(ge=2000, le=2200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    grouped: dict[str, dict] = {}
    for expense in _month_expenses(db, user, month, year):
        for tag in expense.tags or []:
            item = grouped.setdefault(tag, {"tag": tag, "total": 0, "count": 0})
            item["total"] += expense.amount
            item["count"] += 1
    return envelope(sorted(grouped.values(), key=lambda item: item["total"], reverse=True))


@router.get("/monthly-trend")
def monthly_trend(months: int = Query(default=6, ge=1, le=24), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    today = date.today().replace(day=1)
    result = []
    for offset in range(months - 1, -1, -1):
        current = today.month - offset
        year = today.year + (current - 1) // 12
        month = (current - 1) % 12 + 1
        total = sum(item.amount for item in _month_expenses(db, user, month, year))
        result.append({"monthKey": f"{year:04d}-{month:02d}", "monthLabel": date(year, month, 1).strftime("%b %Y"), "total": total})
    return envelope(result)


@router.put("/{expense_id}")
def update_expense(expense_id: str, data: ExpenseUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = owned_expense(expense_id, db, user)
    for key, value in data.model_dump().items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return envelope(expense)


@router.patch("/{expense_id}/toggle-paid")
def toggle_expense(expense_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = owned_expense(expense_id, db, user)
    expense.paid = not expense.paid
    db.commit()
    db.refresh(expense)
    return envelope({"id": expense.id, "paid": expense.paid, "updatedAt": expense.updated_at})


@router.delete("/{expense_id}")
def delete_expense(expense_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = owned_expense(expense_id, db, user)
    expense.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return envelope(message="Expense deleted successfully")


def _month_expenses(db: Session, user: User, month: int, year: int) -> list[Transaction]:
    query = select(Transaction).where(Transaction.user_id == user.id, Transaction.deleted_at.is_(None), Transaction.date >= date(year, month, 1), Transaction.date <= date(year, month, monthrange(year, month)[1]))
    return list(db.scalars(query))


class SyncPayload(BaseModel):
    lastSyncedAt: datetime | None = None
    created: list[ExpenseCreate] = Field(default_factory=list)
    updated: list["ExpenseSyncUpdate"] = Field(default_factory=list)
    deletedIds: list[str] = Field(default_factory=list)


class ExpenseSyncUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    description: str | None = Field(default=None, min_length=1, max_length=255)
    amount: float | None = Field(default=None, gt=0)
    person: str | None = Field(default=None, min_length=1, max_length=120)
    date: DateType | None = None
    tags: list[str] | None = Field(default=None, max_length=30)
    paid: bool | None = None
    source: str | None = Field(default=None, pattern="^(manual|notification|import)$")
    updated_at: datetime | None = Field(default=None, alias="updatedAt")


@router.post("/sync")
def sync_expenses(payload: SyncPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    for item in payload.created:
        create_expense(item, db, user)
    for item in payload.updated:
        expense = db.scalar(select(Transaction).where(Transaction.id == item.id, Transaction.user_id == user.id))
        if expense and (item.updated_at is None or expense.updated_at <= item.updated_at):
            for key in ("description", "amount", "person", "date", "tags", "paid", "source"):
                value = getattr(item, key)
                if value is not None:
                    setattr(expense, key, value)
    for expense_id in payload.deletedIds:
        expense = db.scalar(select(Transaction).where(Transaction.id == expense_id, Transaction.user_id == user.id))
        if expense:
            expense.deleted_at = datetime.now(timezone.utc)
    db.commit()
    query = select(Transaction).where(Transaction.user_id == user.id)
    if payload.lastSyncedAt:
        query = query.where(Transaction.updated_at > payload.lastSyncedAt)
    changed = list(db.scalars(query))
    return envelope({"serverTime": datetime.now(timezone.utc), "pulled": {"createdOrUpdated": [ExpenseRead.model_validate(item) for item in changed if item.deleted_at is None], "deletedIds": [item.id for item in changed if item.deleted_at is not None]}})


@router.get("/inbox")
def get_inbox(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(list(db.scalars(select(PendingTransaction).where(PendingTransaction.user_id == user.id).order_by(PendingTransaction.created_at.desc()))))


class InboxConfirm(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    person: str = Field(min_length=1, max_length=120)
    tags: list[str] = Field(default_factory=list)
    paid: bool = False


@router.post("/inbox/{pending_id}/confirm")
def confirm_inbox(pending_id: str, data: InboxConfirm, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    pending = db.scalar(select(PendingTransaction).where(PendingTransaction.id == pending_id, PendingTransaction.user_id == user.id))
    if pending is None:
        raise HTTPException(status_code=404, detail="Pending transaction not found")
    expense = Transaction(user_id=user.id, description=data.description, amount=pending.amount, person=data.person, date=pending.date, tags=data.tags, paid=data.paid, source="notification")
    db.add(expense)
    db.delete(pending)
    db.commit()
    db.refresh(expense)
    return envelope(expense)


@router.delete("/inbox/{pending_id}")
def delete_inbox(pending_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    pending = db.scalar(select(PendingTransaction).where(PendingTransaction.id == pending_id, PendingTransaction.user_id == user.id))
    if pending is None:
        raise HTTPException(status_code=404, detail="Pending transaction not found")
    db.delete(pending)
    db.commit()
    return envelope(message="Pending transaction discarded")


@router.get("/{expense_id}")
def get_expense(expense_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(owned_expense(expense_id, db, user))


spec_router.add_api_route("/sync", sync_expenses, methods=["POST"])
spec_router.add_api_route("/inbox", get_inbox, methods=["GET"])
spec_router.add_api_route("/inbox/{pending_id}/confirm", confirm_inbox, methods=["POST"])
spec_router.add_api_route("/inbox/{pending_id}", delete_inbox, methods=["DELETE"])