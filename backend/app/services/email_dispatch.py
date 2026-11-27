import logging
import smtplib
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.card import Card
from app.models.email_delivery import EmailDelivery
from app.models.user import User
from app.services.mailer import first_card_email, send_email

logger = logging.getLogger("cashya.email")
MAX_ATTEMPTS = 5
STALE_DELIVERY_MINUTES = 15


def dispatch_email_once(
    db: Session,
    user: User,
    kind: str,
    period_key: str,
    subject: str,
    body: str,
) -> bool:
    if not settings.email_configured:
        return False

    now = datetime.now(timezone.utc)
    delivery = db.scalar(
        select(EmailDelivery).where(
            EmailDelivery.user_id == user.id,
            EmailDelivery.kind == kind,
            EmailDelivery.period_key == period_key,
        )
    )
    if delivery is None:
        delivery = EmailDelivery(
            user_id=user.id,
            kind=kind,
            period_key=period_key,
            status="sending",
            attempts=1,
        )
        db.add(delivery)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return False
    else:
        if delivery.status == "sent" or delivery.attempts >= MAX_ATTEMPTS:
            return False
        last_updated = delivery.updated_at
        if last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)
        if delivery.status == "sending" and now - last_updated < timedelta(minutes=STALE_DELIVERY_MINUTES):
            return False
        claimed = db.execute(
            update(EmailDelivery)
            .where(
                EmailDelivery.id == delivery.id,
                EmailDelivery.status == delivery.status,
                EmailDelivery.attempts == delivery.attempts,
            )
            .values(
                status="sending",
                attempts=EmailDelivery.attempts + 1,
                updated_at=now,
                last_error=None,
            )
        )
        if claimed.rowcount != 1:
            db.rollback()
            return False
        db.commit()
        db.refresh(delivery)

    try:
        send_email(user.email, subject, body)
    except (smtplib.SMTPException, OSError, RuntimeError):
        logger.exception("Email delivery failed for user %s (%s)", user.id, kind)
        delivery.status = "failed"
        delivery.last_error = "SMTP delivery failed"
        delivery.updated_at = datetime.now(timezone.utc)
        db.commit()
        return False

    delivery.status = "sent"
    delivery.sent_at = datetime.now(timezone.utc)
    delivery.updated_at = delivery.sent_at
    delivery.last_error = None
    db.commit()
    return True


def send_first_card_nudge(user_id: str) -> None:
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None or not user.email_verified or not user.email_notifications_enabled:
            return
        has_card = db.scalar(
            select(Card.id)
            .where(Card.user_id == user.id, Card.deleted_at.is_(None))
            .limit(1)
        )
        if not has_card:
            return
        subject, body = first_card_email(user.name)
        dispatch_email_once(db, user, "first_card_nudge", "first", subject, body)
