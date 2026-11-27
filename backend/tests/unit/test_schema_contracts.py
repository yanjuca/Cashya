from datetime import datetime, timezone
from decimal import Decimal


import pytest
from pydantic import ValidationError

from app.schemas.dashboard import DashboardSummary, WalletCard
from app.schemas.inbox import PendingConfirm, PendingCreate, PendingRead
from app.schemas.auth import validate_password_strength


NOW = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)


def test_dashboard_summary_accepts_empty_cards_and_recent_expenses():
    summary = DashboardSummary.model_validate(
        {
            "month": "2026-11",
            "totalLimit": "1000.00",
            "availableLimit": "800.00",
            "totalSpent": "200.00",
            "pending": "50.00",
            "paid": "150.00",
            "usagePercent": 20.0,
            "expensesCount": 2,
            "cards": [],
            "recentExpenses": [],
        }
    )

    assert summary.total_limit == Decimal("1000.00")
    assert summary.available_limit == Decimal("800.00")
    assert summary.expenses_count == 2
    assert summary.cards == []
    assert summary.recent_expenses == []


def test_wallet_card_validates_nested_card_and_summary():
    wallet_card = WalletCard.model_validate(
        {
            "card": {
                "id": "card-1",
                "holderName": "Main Card",
                "brand": "visa",
                "type": "Credit",
                "lastDigits": "1234",
                "expiryDate": "12/30",
                "limit": "1000.00",
                "colorAccent": "#ff453a",
                "isArchived": False,
                "createdAt": NOW,
                "updatedAt": NOW,
            },
            "summary": {
                "cardId": "card-1",
                "limit": "1000.00",
                "spent": "200.00",
                "pending": "50.00",
                "paid": "150.00",
                "available": "800.00",
                "usagePercent": 20.0,
                "expensesCount": 2,
            },
        }
    )

    assert wallet_card.card.id == "card-1"
    assert wallet_card.summary.available == Decimal("800.00")


def test_pending_create_parses_iso_date_and_keeps_optional_fields():
    pending = PendingCreate(
        description="Card purchase",
        amount="42.90",
        date="2026-11-10T12:00:00Z",
        institution="Example Bank",
        rawText="Purchase approved",
    )

    assert pending.amount == Decimal("42.90")
    assert pending.date == NOW
    assert pending.institution == "Example Bank"
    assert pending.raw_text == "Purchase approved"


def test_pending_create_rejects_non_positive_amount():
    with pytest.raises(ValidationError):
        PendingCreate(description="Invalid transaction", amount=0, date="2026-11-10")


def test_pending_read_accepts_serialized_pending_transaction():
    pending = PendingRead(
        id="pending-1",
        description="Transfer",
        amount=Decimal("18.50"),
        date=NOW,
        institution=None,
        raw_text=None,
        created_at=NOW,
    )

    assert pending.id == "pending-1"
    assert pending.institution is None
    assert pending.raw_text is None


def test_pending_confirm_normalizes_tags_and_applies_defaults():
    confirmation = PendingConfirm(
        description="Groceries",
        person="Ana",
        tags=[" Food ", "food", "Home"],
    )

    assert confirmation.tags == ["Food", "Home"]
    assert confirmation.paid is False
    assert confirmation.card_id is None
    assert confirmation.group_id is None


def test_pending_confirm_rejects_blank_required_fields():
    with pytest.raises(ValidationError):
        PendingConfirm(description="", person="Ana")
    with pytest.raises(ValidationError):
        PendingConfirm(description="Groceries", person="")

def test_pending_confirm_rejects_non_string_tags():
    with pytest.raises(ValidationError):
        PendingConfirm(description="Groceries", person="Ana", tags=["Food", 123])

def test_validate_password_strength_rejects_password_below_minimum_length():
    with pytest.raises(ValueError, match="password must have at least 8 characters"):
        validate_password_strength("short")
