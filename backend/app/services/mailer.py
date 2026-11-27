import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger("cashya.email")


def send_email(recipient: str, subject: str, body: str) -> None:
    if not settings.email_configured:
        raise RuntimeError("SMTP email delivery is not configured")

    message = EmailMessage()
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(
            settings.smtp_host,
            settings.smtp_port,
            timeout=20,
            context=ssl.create_default_context(),
        ) as client:
            _authenticate(client)
            client.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as client:
        client.ehlo()
        if settings.smtp_starttls:
            client.starttls(context=ssl.create_default_context())
            client.ehlo()
        _authenticate(client)
        client.send_message(message)


def _authenticate(client: smtplib.SMTP | smtplib.SMTP_SSL) -> None:
    if settings.smtp_username:
        if not settings.smtp_password:
            raise RuntimeError("SMTP_PASSWORD is required when SMTP_USERNAME is set")
        client.login(settings.smtp_username, settings.smtp_password)


def send_email_best_effort(recipient: str, subject: str, body: str) -> None:
    if getattr(settings, "email_console_fallback", False):
        logger.warning("SMTP not configured (development) - email to %s\nSubject: %s\n\n%s", recipient, subject, body)
        return
    try:
        send_email(recipient, subject, body)
    except (smtplib.SMTPException, OSError, RuntimeError):
        logger.exception("Could not send an email")


def verification_email(name: str, code: str) -> tuple[str, str]:
    return (
        "Verify your Cashya email",
        f"""Hi {name},

Your Cashya email verification code is {code}.
It expires in 15 minutes. Enter it in Settings to enable financial emails.

If you did not create this account, you can ignore this message.""",
    )


def password_reset_email(name: str, code: str) -> tuple[str, str]:
    return (
        "Your Cashya password reset code",
        f"""Hi {name},

Your 6-digit Cashya password reset code is {code}.
It expires in 15 minutes and can be used once.

If you did not request a password reset, ignore this message. Your password will not change.""",
    )


def password_changed_email(name: str) -> tuple[str, str]:
    return (
        "Your Cashya password was changed",
        f"""Hi {name},

The password for your Cashya account was changed, and saved refresh sessions were revoked.
An already-issued access token may remain valid until it expires. If you did not make this change,
reset your password immediately.""",
    )


def email_changed_email(name: str) -> tuple[str, str]:
    return (
        "Your Cashya email address was changed",
        f"""Hi {name},

The email address on your Cashya account was changed. The new address must be verified before
financial emails are sent. If you did not make this change, contact Cashya support.""",
    )


def first_card_email(name: str) -> tuple[str, str]:
    return (
        "Your first card is ready in Cashya",
        f"""Congratulations, {name}!

You added your first card to Cashya. Take a moment to review your expenses, check pending
payments, and set a budget that helps keep your finances in order.""",
    )
