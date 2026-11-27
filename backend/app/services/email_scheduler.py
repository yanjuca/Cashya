import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.card import Card
from app.models.expense import Expense
from app.models.user import User
from app.services.email_dispatch import dispatch_email_once
from app.services.mailer import first_card_email

logger = logging.getLogger("cashya.email.scheduler")


def _previous_month(now: datetime) -> tuple[datetime, datetime, str]:
    this_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 1:
        previous_month = datetime(now.year - 1, 12, 1, tzinfo=timezone.utc)
    else:
        previous_month = datetime(now.year, now.month - 1, 1, tzinfo=timezone.utc)
    return previous_month, this_month, previous_month.strftime("%Y-%m")


def _amount(value: Decimal) -> str:
    return f"{value:,.2f}"


def run_due_email_jobs(now: datetime | None = None) -> None:
    if not settings.email_configured:
        return
    now = now or datetime.now(timezone.utc)
    if now.hour < settings.email_schedule_hour_utc:
        return

    iso_year, iso_week, _ = now.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    month_start, month_end, month_key = _previous_month(now)

    with SessionLocal() as db:
        users = list(
            db.scalars(
                select(User).where(
                    User.is_active.is_(True),
                    User.email_verified.is_(True),
                )
            )
        )
        for user in users:
            if user.email_notifications_enabled:
                has_card = db.scalar(
                    select(Card.id)
                    .where(Card.user_id == user.id, Card.deleted_at.is_(None))
                    .limit(1)
                )
                if has_card:
                    subject, body = first_card_email(user.name)
                    dispatch_email_once(
                        db,
                        user,
                        "first_card_nudge",
                        "first",
                        subject,
                        body,
                    )

                pending = list(
                    db.scalars(
                        select(Expense)
                        .where(
                            Expense.user_id == user.id,
                            Expense.deleted_at.is_(None),
                            Expense.paid.is_(False),
                        )
                        .order_by(Expense.date.asc())
                    )
                )
                if pending:
                    total_pending = sum((expense.amount for expense in pending), Decimal("0"))
                    lines = [
                        f"- {expense.description}: {_amount(expense.amount)} ({expense.date.date().isoformat()})"
                        for expense in pending[:20]
                    ]
                    if len(pending) > 20:
                        lines.append(f"- And {len(pending) - 20} more pending expenses")
                    body = (
                        f"Hi {user.name},\n\n"
                        f"You have {len(pending)} pending expenses totaling {_amount(total_pending)}:\n\n"
                        + "\n".join(lines)
                        + "\n\nOpen CASH to review and update their status."
                    )
                    dispatch_email_once(
                        db,
                        user,
                        "weekly_pending_digest",
                        week_key,
                        "Your weekly CASH pending-expense summary",
                        body,
                    )

            if user.email_reports_enabled:
                expenses = list(
                    db.scalars(
                        select(Expense).where(
                            Expense.user_id == user.id,
                            Expense.deleted_at.is_(None),
                            Expense.date >= month_start,
                            Expense.date < month_end,
                        )
                    )
                )
                total = sum((expense.amount for expense in expenses), Decimal("0"))
                paid = sum((expense.amount for expense in expenses if expense.paid), Decimal("0"))
                pending_total = total - paid
                month_name = month_start.strftime("%B %Y")
                body = (
                    f"Hi {user.name},\n\n"
                    f"Your CASH financial report for {month_name}:\n"
                    f"Expenses: {len(expenses)}\n"
                    f"Total: {_amount(total)}\n"
                    f"Paid: {_amount(paid)}\n"
                    f"Pending: {_amount(pending_total)}\n\n"
                    f"{settings.monthly_report_prompt}\n"
                )
                dispatch_email_once(
                    db,
                    user,
                    "monthly_financial_report",
                    month_key,
                    f"Your CASH financial report for {month_name}",
                    body,
                )


async def run_email_scheduler() -> None:
    while True:
        try:
            await asyncio.to_thread(run_due_email_jobs)
        except Exception:
            logger.exception("Scheduled email processing failed")
        await asyncio.sleep(60)
