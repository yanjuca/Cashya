from datetime import date, datetime
from math import ceil

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.expense import Expense
from app.models.user import User
from app.schemas.common import Pagination, ensure_utc
from app.schemas.expenses import ExpenseCreate, ExpenseListData, ExpensePatch, ExpenseRead, ExpenseStatus, ExpenseUpdate, TogglePaidData
from app.services.expenses import (
    apply_filters,
    calendar_days,
    create_expense,
    get_visible_expense,
    month_bounds,
    month_key,
    paginate,
    patch_expense,
    replace_expense,
    shift_month,
    soft_delete_expense,
    summarize,
    visible_expenses,
)

router = APIRouter()


def _utc(value: datetime | None) -> datetime | None:
    return ensure_utc(value) if value else None


@router.get("", summary="List expenses with filters, pagination and delta sync (since)")
def list_expenses(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    search_text: str | None = Query(default=None, alias="searchText", max_length=255),
    person: str | None = Query(default=None, max_length=120),
    tag: str | None = Query(default=None, max_length=40),
    status_filter: ExpenseStatus = Query(default="all", alias="status"),
    card_id: str | None = Query(default=None, alias="cardId", max_length=36),
    group_id: str | None = Query(default=None, alias="groupId", max_length=36),
    start_date: datetime | None = Query(default=None, alias="startDate"),
    end_date: datetime | None = Query(default=None, alias="endDate"),
    since: datetime | None = Query(default=None, description="Return only items updated at or after this instant (includes soft-deleted ones)"),
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2200),
    requested_date: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    query = visible_expenses(db, user, include_deleted=since is not None)
    query = apply_filters(
        query,
        search_text=search_text,
        person=person,
        tag=tag,
        status_filter=status_filter,
        card_id=card_id,
        group_id=group_id,
        start_date=_utc(start_date),
        end_date=_utc(end_date),
        month=month,
        year=year,
        requested_date=requested_date,
        since=_utc(since),
    )
    items, total = paginate(db, query, page, limit)
    total_pages = max(1, ceil(total / limit))
    data = ExpenseListData(items=[ExpenseRead.model_validate(item) for item in items], pagination=Pagination(page=page, limit=limit, total=total, total_pages=total_pages, has_next=page < total_pages))
    return envelope(data)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create an expense (client UUID accepted, idempotent)")
def add_expense(data: ExpenseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(ExpenseRead.model_validate(create_expense(db, user, data)), "Expense created successfully")


@router.get("/summary", summary="Totals (total, paid, pending, count, average) for a month")
def expense_summary(
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=2000, le=2200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return envelope(summarize(_month_expenses(db, user, month, year)))


@router.get("/calendar", summary="Per-day totals for the calendar screen")
def expense_calendar(
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=2000, le=2200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    expenses = _month_expenses(db, user, month, year)
    return envelope({"month": month_key(year, month), "summary": summarize(expenses), "days": calendar_days(expenses)})


@router.get("/by-person", summary="Totals grouped by person for a month")
def by_person(month: int = Query(ge=1, le=12), year: int = Query(ge=2000, le=2200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    grouped: dict[str, dict] = {}
    for expense in _month_expenses(db, user, month, year):
        item = grouped.setdefault(expense.person, {"name": expense.person, "total": 0, "pending": 0, "paid": 0, "count": 0})
        item["total"] += expense.amount
        item["paid" if expense.paid else "pending"] += expense.amount
        item["count"] += 1
    return envelope(sorted(grouped.values(), key=lambda item: item["total"], reverse=True))


@router.get("/by-tag", summary="Totals grouped by tag for a month")
def by_tag(month: int = Query(ge=1, le=12), year: int = Query(ge=2000, le=2200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    grouped: dict[str, dict] = {}
    for expense in _month_expenses(db, user, month, year):
        for tag in expense.tags or []:
            item = grouped.setdefault(tag, {"tag": tag, "total": 0, "pending": 0, "count": 0})
            item["total"] += expense.amount
            item["pending"] += 0 if expense.paid else expense.amount
            item["count"] += 1
    return envelope(sorted(grouped.values(), key=lambda item: item["total"], reverse=True))


@router.get("/monthly-trend", summary="Total per month for the last N months")
def monthly_trend(months: int = Query(default=6, ge=1, le=24), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    today = date.today()
    result = []
    for offset in range(months - 1, -1, -1):
        year, month = shift_month(today.year, today.month, -offset)
        total = sum(item.amount for item in _month_expenses(db, user, month, year))
        result.append({"monthKey": month_key(year, month), "monthLabel": date(year, month, 1).strftime("%b %Y"), "total": total})
    return envelope(result)


@router.get("/{expense_id}", summary="Expense details")
def get_expense(expense_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(ExpenseRead.model_validate(get_visible_expense(db, user, expense_id)))


@router.put("/{expense_id}", summary="Replace all expense fields")
def put_expense(expense_id: str, data: ExpenseUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = get_visible_expense(db, user, expense_id)
    return envelope(ExpenseRead.model_validate(replace_expense(db, user, expense, data)))


@router.patch("/{expense_id}", summary="Partially update an expense")
def edit_expense(expense_id: str, data: ExpensePatch, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = get_visible_expense(db, user, expense_id)
    return envelope(ExpenseRead.model_validate(patch_expense(db, user, expense, data)))


@router.patch("/{expense_id}/toggle-paid", summary="Flip the paid flag")
def toggle_expense(expense_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = get_visible_expense(db, user, expense_id)
    expense.paid = not expense.paid
    db.commit()
    db.refresh(expense)
    return envelope(TogglePaidData(id=expense.id, paid=expense.paid, updated_at=expense.updated_at))


@router.delete("/{expense_id}", summary="Soft delete (propagated to other devices through sync)")
def delete_expense(expense_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    expense = get_visible_expense(db, user, expense_id)
    soft_delete_expense(db, expense)
    return envelope({"id": expense.id, "deletedAt": expense.deleted_at}, "Expense deleted successfully")


def _month_expenses(db: Session, user: User, month: int, year: int) -> list[Expense]:
    start, end = month_bounds(year, month)
    return list(db.scalars(visible_expenses(db, user).where(Expense.date >= start, Expense.date <= end)))
