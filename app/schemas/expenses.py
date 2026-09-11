from datetime import datetime, timezone
from decimal import Decimal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


def parse_expense_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and len(value) == 10:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    raise ValueError("date must be an ISO 8601 datetime")


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    person: str = Field(min_length=1, max_length=120)
    date: datetime
    tags: list[str] = Field(default_factory=list, max_length=30)
    paid: bool = False
    source: str = Field(default="manual", pattern="^(manual|notification|import)$")

    _normalize_date = field_validator("date", mode="before")(parse_expense_datetime)


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    person: str = Field(min_length=1, max_length=120)
    date: datetime
    tags: list[str] = Field(default_factory=list, max_length=30)
    paid: bool = False

    _normalize_date = field_validator("date", mode="before")(parse_expense_datetime)


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    description: str
    amount: Decimal
    person: str
    date: datetime
    tags: list[str]
    paid: bool
    source: str
    created_at: datetime = Field(validation_alias=AliasChoices("created_at", "createdAt"), serialization_alias="createdAt")
    updated_at: datetime = Field(validation_alias=AliasChoices("updated_at", "updatedAt"), serialization_alias="updatedAt")