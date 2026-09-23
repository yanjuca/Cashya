from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.models.card import DEFAULT_CARD_COLOR
from app.schemas.common import CamelModel

CardBrand = Literal["visa", "mastercard", "elo", "generic"]
CardType = Literal["Credit", "Debit"]

EXPIRY_PATTERN = r"^(0[1-9]|1[0-2])/\d{2}$"
LAST_DIGITS_PATTERN = r"^\d{1,4}$"
COLOR_PATTERN = r"^#(?:[0-9a-fA-F]{3}){1,2}$"


def normalize_brand(value: object) -> object:
    return value.lower() if isinstance(value, str) else value


def normalize_type(value: object) -> object:
    return value.capitalize() if isinstance(value, str) else value


class CardBase(CamelModel):
    holder_name: str = Field(min_length=1, max_length=120)
    brand: CardBrand = "generic"
    type: CardType = "Credit"
    last_digits: str = Field(pattern=LAST_DIGITS_PATTERN)
    expiry_date: str = Field(pattern=EXPIRY_PATTERN, description="MM/YY")
    limit: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    color_accent: str = Field(default=DEFAULT_CARD_COLOR, pattern=COLOR_PATTERN)

    _brand = field_validator("brand", mode="before")(normalize_brand)
    _type = field_validator("type", mode="before")(normalize_type)


class CardCreate(CardBase):
    id: str | None = Field(default=None, min_length=1, max_length=36, description="Client generated UUID (offline first)")
    is_archived: bool = False


class CardUpdate(CardBase):
    is_archived: bool = False


class CardPatch(CamelModel):
    holder_name: str | None = Field(default=None, min_length=1, max_length=120)
    brand: CardBrand | None = None
    type: CardType | None = None
    last_digits: str | None = Field(default=None, pattern=LAST_DIGITS_PATTERN)
    expiry_date: str | None = Field(default=None, pattern=EXPIRY_PATTERN)
    limit: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    color_accent: str | None = Field(default=None, pattern=COLOR_PATTERN)
    is_archived: bool | None = None

    _brand = field_validator("brand", mode="before")(normalize_brand)
    _type = field_validator("type", mode="before")(normalize_type)


class CardRead(CamelModel):
    id: str
    holder_name: str
    brand: str
    type: str
    last_digits: str
    expiry_date: str
    limit: Decimal
    color_accent: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class CardSummary(CamelModel):
    """Numbers shown on the wallet card: limit, what was spent and what is still available."""

    card_id: str
    limit: Decimal
    spent: Decimal
    pending: Decimal
    paid: Decimal
    available: Decimal
    usage_percent: float
    expenses_count: int
