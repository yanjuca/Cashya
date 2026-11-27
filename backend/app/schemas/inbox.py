from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel, parse_iso_datetime
from app.schemas.expenses import MAX_TAGS, normalize_tags


class PendingCreate(CamelModel):
    """A transaction captured from a bank notification, waiting for the user to confirm."""

    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date: datetime
    institution: str | None = Field(default=None, max_length=100)
    raw_text: str | None = Field(default=None, max_length=2000)

    _date = field_validator("date", mode="before")(parse_iso_datetime)


class PendingRead(CamelModel):
    id: str
    description: str
    amount: Decimal
    date: datetime
    institution: str | None = None
    raw_text: str | None = None
    created_at: datetime


class PendingConfirm(CamelModel):
    description: str = Field(min_length=1, max_length=255)
    person: str = Field(min_length=1, max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)
    paid: bool = False
    card_id: str | None = Field(default=None, max_length=36)
    group_id: str | None = Field(default=None, max_length=36)

    _tags = field_validator("tags", mode="before")(normalize_tags)
