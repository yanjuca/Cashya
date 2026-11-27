import re
from datetime import date as DateType
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel, Pagination, parse_iso_datetime

ExpenseSource = Literal["manual", "notification", "import"]
ExpenseStatus = Literal["all", "pending", "paid"]

TAG_MAX_LENGTH = 40
MAX_TAGS = 30
# Same cap as the app's RecurringToggle; 0/None means "repeat with no end".
MAX_RECURRING_MONTHS = 120
MAX_SKIPPED_MONTHS = 240
# The app's monthKey(): `${year}-${month}` with a 1-based, non-padded month (e.g. "2026-1", "2026-11").
MONTH_KEY_PATTERN = re.compile(r"^\d{4}-(?:[1-9]|1[0-2])$")


def normalize_tags(value: object) -> object:
    if not isinstance(value, list):
        return value
    seen: set[str] = set()
    tags: list[str] = []
    for tag in value:
        if not isinstance(tag, str):
            raise ValueError("tags must be strings")
        cleaned = tag.strip()
        if not cleaned or len(cleaned) > TAG_MAX_LENGTH:
            raise ValueError(f"each tag must have between 1 and {TAG_MAX_LENGTH} characters")
        if cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            tags.append(cleaned)
    return tags


def normalize_skipped_months(value: object) -> object:
    """Validate month keys and drop duplicates, keeping the app's exact spelling so its lookups still match."""
    if value is None:
        return []
    if not isinstance(value, list):
        return value
    months: list[str] = []
    for item in value:
        if not isinstance(item, str) or not MONTH_KEY_PATTERN.match(item.strip()):
            raise ValueError("each skipped month must look like YYYY-M (e.g. 2026-1 or 2026-11)")
        if item.strip() not in months:
            months.append(item.strip())
    return months


class ExpenseBase(CamelModel):
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    person: str = Field(min_length=1, max_length=120)
    date: datetime
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)
    paid: bool = False
    source: ExpenseSource = "manual"
    card_id: str | None = Field(default=None, max_length=36)
    group_id: str | None = Field(default=None, max_length=36)
    recurring: bool = False
    recurring_months: int | None = Field(default=None, ge=0, le=MAX_RECURRING_MONTHS)
    recurring_source_id: str | None = Field(default=None, min_length=1, max_length=36)
    skipped_months: list[str] = Field(default_factory=list, max_length=MAX_SKIPPED_MONTHS)

    _date = field_validator("date", mode="before")(parse_iso_datetime)
    _tags = field_validator("tags", mode="before")(normalize_tags)
    _skipped = field_validator("skipped_months", mode="before")(normalize_skipped_months)


class ExpenseCreate(ExpenseBase):
    id: str | None = Field(default=None, min_length=1, max_length=36, description="Client generated UUID (offline first)")


class ExpenseUpdate(ExpenseBase):
    """PUT: full replacement of the mutable fields."""


class ExpensePatch(CamelModel):
    """PATCH: partial update, only the provided fields change."""

    description: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    person: str | None = Field(default=None, min_length=1, max_length=120)
    date: datetime | None = None
    tags: list[str] | None = Field(default=None, max_length=MAX_TAGS)
    paid: bool | None = None
    source: ExpenseSource | None = None
    card_id: str | None = Field(default=None, max_length=36)
    group_id: str | None = Field(default=None, max_length=36)
    recurring: bool | None = None
    recurring_months: int | None = Field(default=None, ge=0, le=MAX_RECURRING_MONTHS)
    recurring_source_id: str | None = Field(default=None, min_length=1, max_length=36)
    skipped_months: list[str] | None = Field(default=None, max_length=MAX_SKIPPED_MONTHS)

    _date = field_validator("date", mode="before")(parse_iso_datetime)
    _tags = field_validator("tags", mode="before")(normalize_tags)
    _skipped = field_validator("skipped_months", mode="before")(normalize_skipped_months)


class ExpenseRead(CamelModel):
    id: str
    user_id: str
    description: str
    amount: Decimal
    person: str
    date: datetime
    tags: list[str]
    paid: bool
    source: str
    card_id: str | None = None
    group_id: str | None = None
    recurring: bool = False
    recurring_months: int | None = None
    recurring_source_id: str | None = None
    skipped_months: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    # Rows created before the recurrence columns existed may hold NULLs.
    @field_validator("recurring", mode="before")
    @classmethod
    def _recurring_default(cls, value: object) -> object:
        return False if value is None else value

    @field_validator("skipped_months", mode="before")
    @classmethod
    def _skipped_default(cls, value: object) -> object:
        return [] if value is None else value


class ExpenseListData(CamelModel):
    items: list[ExpenseRead]
    pagination: Pagination


class ExpenseSummary(CamelModel):
    total: Decimal
    paid: Decimal
    pending: Decimal
    count: int
    average: Decimal


class CalendarDay(CamelModel):
    """Aggregated totals for a single day, used by the calendar screen."""

    date: DateType
    total: Decimal
    pending: Decimal
    paid: Decimal
    count: int


class TogglePaidData(CamelModel):
    id: str
    paid: bool
    updated_at: datetime
