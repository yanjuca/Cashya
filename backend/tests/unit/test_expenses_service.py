from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.expense import Expense
from app.models.group import GroupMember
from app.schemas.expenses import ExpenseCreate, ExpensePatch, ExpenseUpdate
from app.services import expenses as service


def _create_payload(**overrides):
    values = {
        "description": "Lunch",
        "amount": "35.50",
        "person": "Ana",
        "date": "2026-09-15T12:00:00Z",
        "tags": ["Food"],
    }
    values.update(overrides)
    return ExpenseCreate.model_validate(values)


def test_month_bounds_returns_first_and_last_moments_of_month():
    start, end = service.month_bounds(2024, 2)
    assert start == datetime(2024, 2, 1, tzinfo=timezone.utc)
    assert end == datetime(2024, 2, 29, 23, 59, 59, 999999, tzinfo=timezone.utc)


def test_day_bounds_covers_full_day_in_utc():
    start, end = service.day_bounds(date(2026, 9, 10))
    assert start == datetime(2026, 9, 10, 0, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 9, 10, 23, 59, 59, 999999, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("year", "month", "offset", "expected"),
    [
        (2026, 9, 1, (2026, 10)),
        (2026, 1, -1, (2025, 12)),
        (2026, 12, 2, (2027, 2)),
        (2026, 3, -15, (2024, 12)),
    ],
)
def test_shift_month_handles_year_boundaries(year, month, offset, expected):
    assert service.shift_month(year, month, offset) == expected


def test_month_key_zero_pads_month():
    assert service.month_key(2026, 4) == "2026-04"


def test_summarize_returns_zero_values_for_empty_list():
    result = service.summarize([])
    assert result.total == Decimal("0")
    assert result.paid == Decimal("0")
    assert result.pending == Decimal("0")
    assert result.count == 0
    assert result.average == Decimal("0")


def test_summarize_calculates_paid_pending_and_average(make_expense, user):
    first = make_expense(user, amount="10.10", paid=True)
    second = make_expense(user, amount="20.00", paid=False, description="Transport")
    result = service.summarize([first, second])
    assert result.total == Decimal("30.10")
    assert result.paid == Decimal("10.10")
    assert result.pending == Decimal("20.00")
    assert result.count == 2
    assert result.average == Decimal("15.05")


def test_calendar_days_groups_by_utc_date_and_orders_days(make_expense, user):
    late = make_expense(user, amount="30", paid=True)
    # SQLite drops timezone metadata when persisting DateTime values.
    # Restore aware datetimes in memory to test the UTC grouping behavior itself.
    late.date = datetime(
        2026, 9, 11, 1, 0,
        tzinfo=timezone(timedelta(hours=3)),
    )

    early = make_expense(user, amount="10")
    early.date = datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc)

    same_utc_day = make_expense(user, amount="5", paid=False)
    same_utc_day.date = datetime(2026, 9, 11, 3, 0, tzinfo=timezone.utc)

    days = service.calendar_days([late, early, same_utc_day])
    assert [item.date for item in days] == [date(2026, 9, 10), date(2026, 9, 11)]
    assert days[0].total == Decimal("40")
    assert days[0].paid == Decimal("30")
    assert days[0].pending == Decimal("10")
    assert days[0].count == 2
    assert days[1].total == Decimal("5")
    assert days[1].pending == Decimal("5")
    assert days[1].count == 1


def test_user_group_ids_returns_only_groups_where_user_is_member(db_session, user, other_user, make_group):
    own_group = make_group(user)
    make_group(other_user)
    assert service.user_group_ids(db_session, user) == [own_group.id]


def test_visible_expenses_includes_owned_and_member_group_expenses(make_expense, make_group, user, other_user, db_session):
    group = make_group(user, members=(other_user,))
    owned = make_expense(user, description="Personal")
    shared_by_other = make_expense(other_user, description="Shared", group_id=group.id)
    make_expense(other_user, description="Private")
    visible = list(db_session.scalars(service.visible_expenses(db_session, user)))
    assert {item.id for item in visible} == {owned.id, shared_by_other.id}


def test_visible_expenses_excludes_soft_deleted_unless_requested(make_expense, db_session, user):
    deleted = make_expense(user, deleted_at=datetime.now(timezone.utc))
    assert list(db_session.scalars(service.visible_expenses(db_session, user))) == []
    assert [item.id for item in db_session.scalars(service.visible_expenses(db_session, user, include_deleted=True))] == [deleted.id]


def test_get_visible_expense_returns_404_for_another_users_private_expense(make_expense, user, other_user, db_session):
    private = make_expense(other_user)
    with pytest.raises(HTTPException) as error:
        service.get_visible_expense(db_session, user, private.id)
    assert error.value.status_code == 404


def test_get_visible_expense_can_return_deleted_when_requested(make_expense, user, db_session):
    deleted = make_expense(user, deleted_at=datetime.now(timezone.utc))
    assert service.get_visible_expense(db_session, user, deleted.id, include_deleted=True).id == deleted.id


def test_validate_card_accepts_none_and_active_owned_card(make_card, user, db_session):
    card = make_card(user)
    assert service.validate_card(db_session, user, None) is None
    assert service.validate_card(db_session, user, card.id) is None


@pytest.mark.parametrize("card_state", ["missing", "other_user", "deleted"])
def test_validate_card_rejects_missing_foreign_or_deleted_card(card_state, make_card, user, other_user, db_session):
    if card_state == "missing":
        card_id = "not-a-card"
    elif card_state == "other_user":
        card_id = make_card(other_user).id
    else:
        card_id = make_card(user, deleted_at=datetime.now(timezone.utc)).id
    with pytest.raises(HTTPException) as error:
        service.validate_card(db_session, user, card_id)
    assert error.value.status_code == 422
    assert error.value.detail[0]["field"] == "cardId"


def test_validate_group_accepts_only_members(db_session, user, other_user, make_group):
    group = make_group(user, members=(other_user,))
    assert service.validate_group(db_session, user, None) is None
    assert service.validate_group(db_session, user, group.id) is None
    with pytest.raises(HTTPException) as error:
        service.validate_group(db_session, other_user, "missing-group")
    assert error.value.status_code == 422


def test_apply_filters_combines_search_person_status_and_tag(make_expense, user, db_session):
    matching = make_expense(user, description="Supermarket", person="Ana", tags=["Food"], paid=False)
    make_expense(user, description="Cinema", person="Bruno", tags=["Leisure"], paid=True)
    query = service.apply_filters(
        service.visible_expenses(db_session, user),
        search_text="  SUPER ",
        person="ana",
        tag="Food",
        status_filter="pending",
    )
    assert [item.id for item in db_session.scalars(query)] == [matching.id]


def test_apply_filters_supports_year_and_month_bounds(make_expense, user, db_session):
    in_month = make_expense(user, date=datetime(2024, 2, 29, 23, 0, tzinfo=timezone.utc))
    make_expense(user, date=datetime(2024, 3, 1, tzinfo=timezone.utc))
    query = service.apply_filters(service.visible_expenses(db_session, user), month=2, year=2024)
    assert [item.id for item in db_session.scalars(query)] == [in_month.id]


def test_apply_filters_supports_requested_date_over_month_and_year(make_expense, user, db_session):
    same_day = make_expense(user, date=datetime(2026, 9, 10, 23, 59, tzinfo=timezone.utc))
    make_expense(user, date=datetime(2026, 9, 11, tzinfo=timezone.utc))
    query = service.apply_filters(
        service.visible_expenses(db_session, user),
        requested_date=date(2026, 9, 10),
        month=9,
        year=2026,
    )
    assert [item.id for item in db_session.scalars(query)] == [same_day.id]


def test_apply_filters_supports_explicit_date_range_and_delta_timestamp(make_expense, user, db_session):
    since = datetime(2026, 9, 14, tzinfo=timezone.utc)
    recent = make_expense(user, date=datetime(2026, 9, 15, tzinfo=timezone.utc), updated_at=datetime(2026, 9, 15, tzinfo=timezone.utc))
    make_expense(user, date=datetime(2026, 9, 13, tzinfo=timezone.utc), updated_at=datetime(2026, 9, 13, tzinfo=timezone.utc))
    query = service.apply_filters(
        service.visible_expenses(db_session, user),
        start_date=datetime(2026, 9, 14, tzinfo=timezone.utc),
        end_date=datetime(2026, 9, 16, tzinfo=timezone.utc),
        since=since,
    )
    assert [item.id for item in db_session.scalars(query)] == [recent.id]


def test_apply_filters_supports_card_and_group_ids(make_expense, make_card, make_group, user, other_user, db_session):
    card = make_card(user)
    group = make_group(user, members=(other_user,))
    expected = make_expense(user, card_id=card.id, group_id=group.id)
    make_expense(user)
    query = service.apply_filters(service.visible_expenses(db_session, user), card_id=card.id, group_id=group.id)
    assert [item.id for item in db_session.scalars(query)] == [expected.id]


def test_paginate_returns_total_and_requested_page(make_expense, user, db_session):
    first = make_expense(user, description="First", date=datetime(2026, 9, 10, tzinfo=timezone.utc))
    second = make_expense(user, description="Second", date=datetime(2026, 9, 11, tzinfo=timezone.utc))
    third = make_expense(user, description="Third", date=datetime(2026, 9, 12, tzinfo=timezone.utc))
    items, total = service.paginate(db_session, service.visible_expenses(db_session, user), page=2, limit=1)
    assert total == 3
    assert [item.id for item in items] == [second.id]


def test_create_expense_persists_and_applies_default_id(make_user, user, db_session):
    data = _create_payload()
    created = service.create_expense(db_session, user, data)
    assert created.id
    assert created.user_id == user.id
    assert created.source == "manual"


def test_create_expense_is_idempotent_for_same_user_and_client_id(make_expense, user, db_session):
    existing = make_expense(user, expense_id="client-expense-1", description="Old")
    updated = service.create_expense(db_session, user, _create_payload(id="client-expense-1", description="Retried"))
    assert updated.id == existing.id
    assert updated.description == "Retried"
    assert len(list(db_session.scalars(select(Expense).where(Expense.id == existing.id)))) == 1


def test_create_expense_rejects_id_owned_by_another_user(make_expense, user, other_user, db_session):
    make_expense(other_user, expense_id="shared-client-id")
    with pytest.raises(HTTPException) as error:
        service.create_expense(db_session, user, _create_payload(id="shared-client-id"))
    assert error.value.status_code == 409


def test_create_expense_rejects_card_not_owned_by_user(make_card, user, other_user, db_session):
    foreign_card = make_card(other_user)
    with pytest.raises(HTTPException) as error:
        service.create_expense(db_session, user, _create_payload(cardId=foreign_card.id))
    assert error.value.status_code == 422


def test_replace_expense_replaces_all_mutable_fields(make_expense, user, db_session):
    existing = make_expense(user, description="Old", amount="10", tags=["Old"])
    updated = service.replace_expense(
        db_session,
        user,
        existing,
        ExpenseUpdate(description="New", amount="20", person="Ana", date="2026-09-16", tags=["New"], paid=True),
    )
    assert updated.description == "New"
    assert updated.amount == Decimal("20")
    assert updated.tags == ["New"]
    assert updated.paid is True


def test_patch_expense_changes_only_fields_provided(make_expense, user, db_session):
    existing = make_expense(user, description="Keep description", tags=["Home"], paid=False)
    updated = service.patch_expense(db_session, user, existing, ExpensePatch(paid=True))
    assert updated.paid is True
    assert updated.description == "Keep description"
    assert updated.tags == ["Home"]


def test_patch_expense_validates_card_when_card_id_is_present(make_expense, make_card, user, other_user, db_session):
    existing = make_expense(user)
    foreign_card = make_card(other_user)
    with pytest.raises(HTTPException) as error:
        service.patch_expense(db_session, user, existing, ExpensePatch(cardId=foreign_card.id))
    assert error.value.status_code == 422


def test_soft_delete_expense_sets_deleted_timestamp(make_expense, user, db_session):
    expense = make_expense(user)
    service.soft_delete_expense(db_session, expense)
    assert expense.deleted_at is not None
    assert expense.deleted_at.tzinfo is not None
