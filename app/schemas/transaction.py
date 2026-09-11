from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


def parse_transaction_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and len(value) == 10:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    raise ValueError("date must be an ISO 8601 datetime")


class TransactionBase(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: float = Field(gt=0)
    person: str = Field(min_length=1, max_length=120)
    date: datetime
    tags: list[str] = Field(default_factory=list, max_length=30)
    paid: bool = False
    category_id: str | None = None

    _normalize_date = field_validator("date", mode="before")(parse_transaction_datetime)
    source: str = Field(default="manual", pattern="^(manual|notification|import)$")


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=255)
    amount: float | None = Field(default=None, gt=0)
    person: str | None = Field(default=None, min_length=1, max_length=120)
    date: datetime | None = None
    tags: list[str] | None = Field(default=None, max_length=30)
    paid: bool | None = None
    category_id: str | None = None

    _normalize_date = field_validator("date", mode="before")(parse_transaction_datetime)
    source: str | None = Field(default=None, pattern="^(manual|notification|import)$")


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
