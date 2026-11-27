from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.card import CardCreate, CardPatch, CardUpdate
from app.services import cards as service


def _card_payload(**overrides):
    values = {
        "holderName": "Travel Card",
        "brand": "visa",
        "type": "Credit",
        "lastDigits": "9876",
        "expiryDate": "11/29",
        "limit": "2500.00",
    }
    values.update(overrides)
    return CardCreate.model_validate(values)


def test_list_cards_filters_archived_and_deleted(make_card, user, db_session):
    active = make_card(user)
    archived = make_card(user, is_archived=True)
    deleted = make_card(user, deleted_at=datetime.now(timezone.utc))
    assert {item.id for item in service.list_cards(db_session, user)} == {active.id}
    assert {item.id for item in service.list_cards(db_session, user, include_archived=True)} == {active.id, archived.id}
    assert {item.id for item in service.list_cards(db_session, user, include_archived=True, include_deleted=True)} == {active.id, archived.id, deleted.id}


def test_get_owned_card_returns_card_for_owner(make_card, user, db_session):
    card = make_card(user)
    assert service.get_owned_card(db_session, user, card.id).id == card.id


@pytest.mark.parametrize("case", ["missing", "foreign", "deleted"])
def test_get_owned_card_returns_404_for_missing_foreign_or_deleted_card(case, make_card, user, other_user, db_session):
    if case == "missing":
        card_id = str(uuid4())
    elif case == "foreign":
        card_id = make_card(other_user).id
    else:
        card_id = make_card(user, deleted_at=datetime.now(timezone.utc)).id
    with pytest.raises(HTTPException) as error:
        service.get_owned_card(db_session, user, card_id)
    assert error.value.status_code == 404


def test_get_owned_card_can_include_deleted_card(make_card, user, db_session):
    card = make_card(user, deleted_at=datetime.now(timezone.utc))
    assert service.get_owned_card(db_session, user, card.id, include_deleted=True).id == card.id


def test_create_card_creates_new_card(make_card, user, db_session):
    card = service.create_card(db_session, user, _card_payload())
    assert card.user_id == user.id
    assert card.holder_name == "Travel Card"
    assert card.limit == Decimal("2500.00")


def test_create_card_upserts_same_users_soft_deleted_card(make_card, user, db_session):
    card = make_card(user, card_id="client-card-1", deleted_at=datetime.now(timezone.utc))
    restored = service.create_card(db_session, user, _card_payload(id="client-card-1", holderName="Restored"))
    assert restored.id == card.id
    assert restored.deleted_at is None
    assert restored.holder_name == "Restored"


def test_create_card_rejects_id_owned_by_another_user(make_card, user, other_user, db_session):
    foreign = make_card(other_user, card_id="foreign-card-id")
    with pytest.raises(HTTPException) as error:
        service.create_card(db_session, user, _card_payload(id=foreign.id))
    assert error.value.status_code == 409


def test_replace_card_replaces_all_mutable_fields(make_card, user, db_session):
    card = make_card(user)
    updated = service.replace_card(
        db_session,
        card,
        CardUpdate(holderName="Changed", brand="mastercard", type="Debit", lastDigits="2222", expiryDate="10/31", limit=500, colorAccent="#123456", isArchived=True),
    )
    assert updated.holder_name == "Changed"
    assert updated.brand == "mastercard"
    assert updated.type == "Debit"
    assert updated.is_archived is True


def test_patch_card_changes_only_provided_fields(make_card, user, db_session):
    card = make_card(user, holder_name="Original", limit="1000")
    updated = service.patch_card(db_session, card, CardPatch(limit=750))
    assert updated.limit == Decimal("750")
    assert updated.holder_name == "Original"
    assert updated.brand == "visa"


def test_soft_delete_card_marks_archived_and_detaches_expenses(make_card, make_expense, user, db_session):
    card = make_card(user)
    attached = make_expense(user, card_id=card.id)
    make_expense(user)
    affected = service.soft_delete_card(db_session, card)
    db_session.refresh(attached)
    assert affected == 1
    assert card.deleted_at is not None
    assert card.is_archived is True
    assert attached.card_id is None


def test_card_summary_calculates_credit_card_totals(make_card, make_expense, user, db_session):
    card = make_card(user, limit="1000", type="Credit")
    make_expense(user, card_id=card.id, amount="100", paid=True)
    make_expense(user, card_id=card.id, amount="200", paid=False)
    summary = service.card_summary(db_session, card)
    assert summary.spent == Decimal("300")
    assert summary.paid == Decimal("100")
    assert summary.pending == Decimal("200")
    assert summary.available == Decimal("800")
    assert summary.usage_percent == 30.0
    assert summary.expenses_count == 2


def test_card_summary_debit_available_uses_period_spending(make_card, make_expense, user, db_session):
    card = make_card(user, limit="500", type="Debit")
    make_expense(user, card_id=card.id, amount="150", paid=False)
    make_expense(user, card_id=card.id, amount="100", paid=True)
    summary = service.card_summary(db_session, card)
    assert summary.spent == Decimal("250")
    assert summary.available == Decimal("250")


def test_card_summary_applies_month_filter_to_spent_but_available_uses_all_unpaid(make_card, make_expense, user, db_session):
    card = make_card(user, limit="1000", type="Credit")
    make_expense(user, card_id=card.id, amount="100", date=datetime(2026, 9, 10, tzinfo=timezone.utc), paid=False)
    make_expense(user, card_id=card.id, amount="200", date=datetime(2026, 8, 10, tzinfo=timezone.utc), paid=False)
    summary = service.card_summary(db_session, card, year=2026, month=9)
    assert summary.spent == Decimal("100")
    assert summary.pending == Decimal("100")
    assert summary.available == Decimal("700")
    assert summary.expenses_count == 1


def test_card_summary_handles_zero_limit(make_card, make_expense, user, db_session):
    card = make_card(user, limit="0")
    make_expense(user, card_id=card.id, amount="100")
    summary = service.card_summary(db_session, card)
    assert summary.usage_percent == 0.0
    assert summary.available == Decimal("0")
