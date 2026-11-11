from datetime import datetime, timezone

from app.schemas.expenses import ExpensePatch
from app.services import expenses as service


def test_apply_filters_returns_only_paid_expenses(make_expense, user, db_session):
    paid = make_expense(user, description="Paid", paid=True)
    make_expense(user, description="Pending", paid=False)

    query = service.apply_filters(
        service.visible_expenses(db_session, user),
        status_filter="paid",
    )

    assert [item.id for item in db_session.scalars(query)] == [paid.id]


def test_apply_filters_supports_year_without_month(make_expense, user, db_session):
    in_year = make_expense(user, date=datetime(2024, 6, 15, tzinfo=timezone.utc))
    make_expense(user, date=datetime(2025, 1, 1, tzinfo=timezone.utc))

    query = service.apply_filters(
        service.visible_expenses(db_session, user),
        year=2024,
    )

    assert [item.id for item in db_session.scalars(query)] == [in_year.id]


def test_patch_expense_validates_and_sets_group_id(make_expense, make_group, user, db_session):
    expense = make_expense(user)
    group = make_group(user)

    updated = service.patch_expense(
        db_session,
        user,
        expense,
        ExpensePatch(groupId=group.id),
    )

    assert updated.group_id == group.id
