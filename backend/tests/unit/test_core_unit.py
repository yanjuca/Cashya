from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from pydantic import BaseModel, ValidationError

from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.core.serialization import envelope, serialize_data, to_iso_utc
from app.schemas.auth import RegisterRequest
from app.schemas.card import CardCreate, CardPatch
from app.schemas.common import ensure_utc, parse_iso_datetime
from app.schemas.expenses import ExpenseCreate, ExpensePatch, normalize_tags


def test_ensure_utc_attaches_utc_to_naive_datetime():
    value = datetime(2026, 9, 10, 12, 30)
    assert ensure_utc(value) == value.replace(tzinfo=timezone.utc)


def test_ensure_utc_converts_aware_datetime_to_utc():
    value = datetime(2026, 9, 10, 15, 30, tzinfo=timezone(timedelta(hours=3)))
    assert ensure_utc(value) == datetime(2026, 9, 10, 12, 30, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-09-10", datetime(2026, 9, 10, tzinfo=timezone.utc)),
        ("2026-09-10T12:30:00Z", datetime(2026, 9, 10, 12, 30, tzinfo=timezone.utc)),
        ("2026-09-10T15:30:00+03:00", datetime(2026, 9, 10, 12, 30, tzinfo=timezone.utc)),
    ],
)
def test_parse_iso_datetime_normalizes_supported_values(value, expected):
    assert parse_iso_datetime(value) == expected


def test_parse_iso_datetime_accepts_none_and_datetime():
    value = datetime(2026, 9, 10, 9, 0)
    assert parse_iso_datetime(None) is None
    assert parse_iso_datetime(value) == value.replace(tzinfo=timezone.utc)


def test_parse_iso_datetime_rejects_non_iso_value():
    with pytest.raises(ValueError, match="ISO 8601"):
        parse_iso_datetime(12345)


def test_to_iso_utc_formats_milliseconds_and_z_suffix():
    value = datetime(2026, 9, 10, 15, 30, 45, 123456, tzinfo=timezone(timedelta(hours=3)))
    assert to_iso_utc(value) == "2026-09-10T12:30:45.123Z"


def test_to_iso_utc_treats_naive_datetime_as_utc():
    assert to_iso_utc(datetime(2026, 9, 10, 12, 0)) == "2026-09-10T12:00:00.000Z"


def test_serialize_data_handles_nested_supported_types():
    class Payload(BaseModel):
        created_at: datetime
        amount: Decimal

    result = serialize_data(
        {
            "items": [Payload(created_at=datetime(2026, 9, 10, tzinfo=timezone.utc), amount=Decimal("12.50"))],
            "day": date(2026, 9, 11),
            "tuple": (Decimal("2.25"),),
        }
    )
    assert result == {
        "items": [{"created_at": "2026-09-10T00:00:00.000Z", "amount": 12.5}],
        "day": "2026-09-11",
        "tuple": [2.25],
    }


def test_envelope_includes_message_only_when_provided():
    assert envelope({"value": Decimal("3.5")}) == {"success": True, "data": {"value": 3.5}}
    assert envelope([1], "Saved") == {"success": True, "data": [1], "message": "Saved"}


def test_password_hash_is_verified_without_storing_plaintext():
    hashed = hash_password("password123")
    assert hashed != "password123"
    assert verify_password("password123", hashed) is True
    assert verify_password("incorrect123", hashed) is False


def test_create_and_decode_access_token_round_trip():
    token, expires_in = create_access_token("user-123")
    assert expires_in > 0
    assert decode_access_token(token) == "user-123"


def test_decode_access_token_rejects_invalid_token():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        decode_access_token("not-a-jwt")
    assert error.value.status_code == 401


def test_refresh_token_is_random_and_only_hash_is_deterministic():
    first = generate_refresh_token()
    second = generate_refresh_token()
    assert first != second
    assert hash_refresh_token(first) == hash_refresh_token(first)
    assert hash_refresh_token(first) != first
    assert len(hash_refresh_token(first)) == 64


def test_refresh_token_expiry_is_in_the_future():
    assert refresh_token_expiry() > datetime.now(timezone.utc)


def test_registration_schema_accepts_valid_password_and_email():
    request = RegisterRequest(email="User@Example.com", name="User", password="password123")
    assert request.email.lower() == "user@example.com"


@pytest.mark.parametrize("password", ["short1", "12345678", "onlyletters"])
def test_registration_schema_rejects_weak_password(password):
    with pytest.raises(ValidationError):
        RegisterRequest(email="user@example.com", name="User", password=password)


def test_card_schema_normalizes_brand_and_type():
    card = CardCreate(
        holderName="Main Card",
        brand="VISA",
        type="credit",
        lastDigits="1234",
        expiryDate="12/30",
        limit=1000,
    )
    assert card.brand == "visa"
    assert card.type == "Credit"


def test_card_patch_keeps_omitted_fields_unset():
    patch = CardPatch(limit=500)
    assert patch.model_dump(exclude_unset=True) == {"limit": Decimal("500")}


@pytest.mark.parametrize(
    "payload",
    [
        {"holderName": "Card", "lastDigits": "12345", "expiryDate": "12/30", "limit": 100},
        {"holderName": "Card", "lastDigits": "1234", "expiryDate": "13/30", "limit": 100},
        {"holderName": "Card", "lastDigits": "1234", "expiryDate": "12-30", "limit": 100},
        {"holderName": "Card", "lastDigits": "1234", "expiryDate": "12/30", "limit": -1},
    ],
)
def test_card_schema_rejects_invalid_card_fields(payload):
    with pytest.raises(ValidationError):
        CardCreate.model_validate(payload)


def test_normalize_tags_trims_and_removes_case_insensitive_duplicates():
    assert normalize_tags([" Food ", "food", "HOME", "Home", "Travel"]) == ["Food", "HOME", "Travel"]


@pytest.mark.parametrize("tags", [["   "], ["x" * 41], ["valid", 10]])
def test_normalize_tags_rejects_empty_long_or_non_string_tags(tags):
    with pytest.raises(ValueError):
        normalize_tags(tags)


def test_expense_schema_normalizes_tags_and_date():
    expense = ExpenseCreate(
        description="Groceries",
        amount="15.50",
        person="Ana",
        date="2026-09-10",
        tags=[" Food ", "food", "Home"],
    )
    assert expense.tags == ["Food", "Home"]
    assert expense.date == datetime(2026, 9, 10, tzinfo=timezone.utc)


def test_expense_patch_excludes_unset_values():
    patch = ExpensePatch(paid=True)
    assert patch.model_dump(exclude_unset=True) == {"paid": True}


def test_expense_schema_rejects_zero_or_negative_amount():
    for amount in (0, -1):
        with pytest.raises(ValidationError):
            ExpenseCreate(description="Test", amount=amount, person="Ana", date="2026-09-10")
