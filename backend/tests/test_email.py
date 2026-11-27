from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.card import Card
from app.models.email_delivery import EmailDelivery
from app.models.expense import Expense
from app.models.user import User
from tests.conftest import register


def test_email_delivery_is_sent_only_once_per_period(client, monkeypatch):
    auth = register(client, email="delivery@example.com")
    sent = []
    monkeypatch.setattr("app.services.email_dispatch.settings", SimpleNamespace(email_configured=True))
    monkeypatch.setattr("app.services.email_dispatch.send_email", lambda *args: sent.append(args))

    with SessionLocal() as db:
        user = db.get(User, auth["user"]["id"])
        assert user is not None
        assert email_dispatch_call(db, user) is True
        assert email_dispatch_call(db, user) is False
        delivery = db.scalar(select(EmailDelivery))

    assert len(sent) == 1
    assert delivery is not None
    assert delivery.status == "sent"
    assert delivery.attempts == 1


def email_dispatch_call(db, user):
    from app.services.email_dispatch import dispatch_email_once

    return dispatch_email_once(
        db,
        user,
        "weekly_pending_digest",
        "2026-W11",
        "Pending expenses",
        "Review your expenses.",
    )


def test_scheduler_sends_weekly_digest_only_for_pending_and_monthly_report_for_all(
    client, monkeypatch
):
    first = register(client, email="first@example.com")
    second = register(client, email="second@example.com")
    deliveries = []
    monkeypatch.setattr(
        "app.services.email_scheduler.settings",
        SimpleNamespace(
            email_configured=True,
            email_schedule_hour_utc=12,
            monthly_report_prompt="Keep tracking.",
        ),
    )
    monkeypatch.setattr(
        "app.services.email_scheduler.dispatch_email_once",
        lambda db, user, kind, period, subject, body: deliveries.append(
            (user.id, kind, period, subject, body)
        ),
    )

    with SessionLocal() as db:
        first_user = db.get(User, first["user"]["id"])
        second_user = db.get(User, second["user"]["id"])
        assert first_user is not None and second_user is not None
        first_user.email_verified = True
        second_user.email_verified = True
        db.add(
            Card(
                user_id=first_user.id,
                holder_name="First User",
                brand="visa",
                type="Credit",
                last_digits="1234",
                expiry_date="12/30",
                limit=Decimal("1000.00"),
            )
        )
        db.add(
            Expense(
                user_id=first_user.id,
                description="Rent",
                amount=Decimal("1200.00"),
                person="Me",
                date=datetime(2026, 2, 10, tzinfo=timezone.utc),
                paid=False,
            )
        )
        db.commit()

    from app.services.email_scheduler import run_due_email_jobs

    run_due_email_jobs(datetime(2026, 3, 15, 12, tzinfo=timezone.utc))

    own_ids = {first["user"]["id"], second["user"]["id"]}
    assert [(item[0], item[1]) for item in deliveries].count(
        (first["user"]["id"], "weekly_pending_digest")
    ) == 1
    assert not any(item[0] == second["user"]["id"] and item[1] == "weekly_pending_digest" for item in deliveries)
    assert any(item[0] == first["user"]["id"] and item[1] == "first_card_nudge" for item in deliveries)
    assert not any(item[0] == second["user"]["id"] and item[1] == "first_card_nudge" for item in deliveries)
    reports = [
        item
        for item in deliveries
        if item[0] in own_ids and item[1] == "monthly_financial_report"
    ]
    assert len(reports) == 2
    empty_report = next(item for item in reports if item[0] == second["user"]["id"])
    assert "Expenses: 0" in empty_report[4]
    assert "Keep tracking." in empty_report[4]
