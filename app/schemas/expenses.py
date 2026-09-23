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

    _date = field_validator("date", mode="before")(parse_iso_datetime)
    _tags = field_validator("tags", mode="before")(normalize_tags)


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

    _date = field_validator("date", mode="before")(parse_iso_datetime)
    _tags = field_validator("tags", mode="before")(normalize_tags)


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
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


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
