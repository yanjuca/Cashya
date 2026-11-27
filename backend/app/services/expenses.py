from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.models.card import Card
from app.models.expense import Expense
from app.models.group import GroupMember
from app.models.user import User
from app.schemas.expenses import CalendarDay, ExpenseCreate, ExpensePatch, ExpenseSummary, ExpenseUpdate

ZERO = Decimal("0")


def user_group_ids(db: Session, user: User) -> list[str]:
    return list(db.scalars(select(GroupMember.group_id).where(GroupMember.user_id == user.id)))


def visible_expenses(db: Session, user: User, include_deleted: bool = False) -> Select:
    """Expenses the user owns plus every expense inside a group they belong to."""
    group_ids = user_group_ids(db, user)
    condition = Expense.user_id == user.id
    if group_ids:
        condition = or_(condition, Expense.group_id.in_(group_ids))
    query = select(Expense).where(condition)
    if not include_deleted:
        query = query.where(Expense.deleted_at.is_(None))
    return query


def get_visible_expense(db: Session, user: User, expense_id: str, include_deleted: bool = False) -> Expense:
    expense = db.scalar(visible_expenses(db, user, include_deleted).where(Expense.id == expense_id))
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


def month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59, 999999, tzinfo=timezone.utc)
    return start, end


def day_bounds(day: date) -> tuple[datetime, datetime]:
    return datetime.combine(day, time.min, tzinfo=timezone.utc), datetime.combine(day, time.max, tzinfo=timezone.utc)


def validate_card(db: Session, user: User, card_id: str | None) -> None:
    if card_id is None:
        return
    card = db.scalar(select(Card).where(Card.id == card_id, Card.user_id == user.id, Card.deleted_at.is_(None)))
    if card is None:
        raise HTTPException(status_code=422, detail=[{"field": "cardId", "issue": "Card not found"}])


def validate_group(db: Session, user: User, group_id: str | None) -> None:
    if group_id is None:
        return
    member = db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id))
    if member is None:
        raise HTTPException(status_code=422, detail=[{"field": "groupId", "issue": "Group not found or you are not a member"}])


def apply_filters(
    query: Select,
    *,
    search_text: str | None = None,
    person: str | None = None,
    tag: str | None = None,
    status_filter: str = "all",
    card_id: str | None = None,
    group_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    month: int | None = None,
    year: int | None = None,
    requested_date: date | None = None,
    since: datetime | None = None,
) -> Select:
    if search_text:
        pattern = f"%{search_text.strip().lower()}%"
        query = query.where(or_(func.lower(Expense.description).like(pattern), func.lower(Expense.person).like(pattern)))
    if person:
        query = query.where(func.lower(Expense.person) == person.strip().lower())
    if tag:
        # tags are stored as a JSON array; matching the quoted token keeps the filter on the database side.
        escaped = tag.strip().replace('"', '\\"')
        query = query.where(cast(Expense.tags, String).like(f'%"{escaped}"%'))
    if status_filter == "pending":
        query = query.where(Expense.paid.is_(False))
    elif status_filter == "paid":
        query = query.where(Expense.paid.is_(True))
    if card_id:
        query = query.where(Expense.card_id == card_id)
    if group_id:
        query = query.where(Expense.group_id == group_id)
    if requested_date:
        start, end = day_bounds(requested_date)
        query = query.where(Expense.date >= start, Expense.date <= end)
    elif month and year:
        start, end = month_bounds(year, month)
        query = query.where(Expense.date >= start, Expense.date <= end)
    elif year:
        query = query.where(Expense.date >= datetime(year, 1, 1, tzinfo=timezone.utc), Expense.date < datetime(year + 1, 1, 1, tzinfo=timezone.utc))
    if start_date:
        query = query.where(Expense.date >= start_date)
    if end_date:
        query = query.where(Expense.date <= end_date)
    if since:
        query = query.where(Expense.updated_at >= since)
    return query


def paginate(db: Session, query: Select, page: int, limit: int) -> tuple[list[Expense], int]:
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    items = list(db.scalars(query.order_by(Expense.date.desc(), Expense.created_at.desc()).offset((page - 1) * limit).limit(limit)))
    return items, total


def create_expense(db: Session, user: User, data: ExpenseCreate) -> Expense:
    values = data.model_dump()
    expense_id = values.pop("id")
    validate_card(db, user, values.get("card_id"))
    validate_group(db, user, values.get("group_id"))
    expense = db.get(Expense, expense_id) if expense_id else None
    if expense is not None:
        if expense.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Expense ID already belongs to another user")
        # Idempotent create: the client retried an offline mutation, so treat it as an upsert.
        for key, value in values.items():
            setattr(expense, key, value)
        expense.deleted_at = None
    else:
        expense = Expense(id=expense_id, user_id=user.id, **values)
        db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def replace_expense(db: Session, user: User, expense: Expense, data: ExpenseUpdate) -> Expense:
    values = data.model_dump()
    validate_card(db, user, values.get("card_id"))
    validate_group(db, user, values.get("group_id"))
    for key, value in values.items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


def patch_expense(db: Session, user: User, expense: Expense, data: ExpensePatch) -> Expense:
    values = data.model_dump(exclude_unset=True)
    # An explicit null clears the field; these two columns are NOT NULL, so null means "back to the default".
    if "recurring" in values and values["recurring"] is None:
        values["recurring"] = False
    if "skipped_months" in values and values["skipped_months"] is None:
        values["skipped_months"] = []
    if "card_id" in values:
        validate_card(db, user, values["card_id"])
    if "group_id" in values:
        validate_group(db, user, values["group_id"])
    for key, value in values.items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


def soft_delete_expense(db: Session, expense: Expense) -> None:
    expense.deleted_at = datetime.now(timezone.utc)
    db.commit()


def summarize(expenses: list[Expense]) -> ExpenseSummary:
    total = sum((item.amount for item in expenses), ZERO)
    paid = sum((item.amount for item in expenses if item.paid), ZERO)
    count = len(expenses)
    return ExpenseSummary(total=total, paid=paid, pending=total - paid, count=count, average=(total / count).quantize(Decimal("0.01")) if count else ZERO)


def calendar_days(expenses: list[Expense]) -> list[CalendarDay]:
    buckets: dict[date, dict] = defaultdict(lambda: {"total": ZERO, "pending": ZERO, "paid": ZERO, "count": 0})
    for item in expenses:
        day = (item.date if item.date.tzinfo else item.date.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).date()
        bucket = buckets[day]
        bucket["total"] += item.amount
        bucket["count"] += 1
        if item.paid:
            bucket["paid"] += item.amount
        else:
            bucket["pending"] += item.amount
    return [CalendarDay(date=day, **values) for day, values in sorted(buckets.items())]


def month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def shift_month(year: int, month: int, offset: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + offset
    return index // 12, index % 12 + 1
