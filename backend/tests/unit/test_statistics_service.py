from datetime import datetime, timezone

from app.services.statistics import build_statistics


def test_build_statistics_returns_empty_summary_for_no_expenses():
    result = build_statistics([])
    assert result.summary.total == 0
    assert result.summary.paid == 0
    assert result.summary.pending == 0
    assert result.summary.count == 0
    assert result.summary.average == 0
    assert result.by_person == []
    assert result.by_tag == []
    assert result.by_month == []


def test_build_statistics_aggregates_summary_people_tags_and_months(make_expense, user):
    first = make_expense(
        user,
        amount="100.50",
        person="Ana",
        tags=["Food", "Home"],
        paid=True,
        date=datetime(2026, 9, 10, tzinfo=timezone.utc),
    )
    second = make_expense(
        user,
        amount="50.00",
        person="Bruno",
        tags=["Food"],
        paid=False,
        date=datetime(2026, 8, 10, tzinfo=timezone.utc),
    )
    result = build_statistics([first, second])
    assert result.summary.total == 150.5
    assert result.summary.paid == 100.5
    assert result.summary.pending == 50.0
    assert result.summary.count == 2
    assert result.summary.average == 75.25
    assert result.by_person[0].name == "Ana"
    assert result.by_person[0].pending == 0
    assert result.by_person[1].name == "Bruno"
    assert result.by_person[1].pending == 50
    assert result.by_tag[0].name == "Food"
    assert result.by_tag[0].total == 150.5
    assert result.by_tag[0].count == 2
    assert result.by_tag[1].name == "Home"
    assert [(item.month, item.total) for item in result.by_month] == [("2026-09", 100.5), ("2026-08", 50.0)]


def test_build_statistics_sorts_people_and_tags_by_total(make_expense, user):
    expense_a = make_expense(user, person="A", amount="20", tags=["Small"])
    expense_b = make_expense(user, person="B", amount="80", tags=["Large"])
    result = build_statistics([expense_a, expense_b])
    assert [item.name for item in result.by_person] == ["B", "A"]
    assert [item.name for item in result.by_tag] == ["Large", "Small"]


def test_build_statistics_ignores_missing_tags(make_expense, user):
    expense = make_expense(user, tags=[])
    result = build_statistics([expense])
    assert result.by_tag == []
