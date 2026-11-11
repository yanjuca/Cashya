"""Fixtures for isolated service-level tests using an in-memory SQLite database."""

import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

# Load app settings with safe test values before importing modules that create
# the SQLAlchemy engine. Restore the process environment immediately afterward
# so this conftest does not leak settings into the API tests during a full run.
_TEST_ENV = {
    name: os.environ.get(name)
    for name in ("SECRET_KEY", "DATABASE_URL", "AUTH_RATE_LIMIT_ATTEMPTS")
}
os.environ.update(
    {
        "SECRET_KEY": "cashya-unit-test-secret-key-with-at-least-32-characters",
        "DATABASE_URL": "sqlite+pysqlite:///:memory:",
        "AUTH_RATE_LIMIT_ATTEMPTS": "1000",
    }
)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 - ensure every model is registered in Base.metadata
from app.core.database import Base
from app.core.security import hash_password
from app.models.card import Card
from app.models.expense import Expense
from app.models.group import Group, GroupMember
from app.models.user import User

for _name, _original_value in _TEST_ENV.items():
    if _original_value is None:
        os.environ.pop(_name, None)
    else:
        os.environ[_name] = _original_value
del _name, _original_value, _TEST_ENV


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def make_user(db_session):
    def factory(*, email: str | None = None, name: str = "Test User", password: str = "password123", is_active: bool = True):
        user = User(
            email=email or f"{uuid4()}@example.com",
            name=name,
            password_hash=hash_password(password),
            is_active=is_active,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return factory


@pytest.fixture
def user(make_user):
    return make_user(email="owner@example.com")


@pytest.fixture
def other_user(make_user):
    return make_user(email="other@example.com", name="Other User")


@pytest.fixture
def make_card(db_session):
    def factory(user: User, *, card_id: str | None = None, holder_name: str = "MAIN CARD", brand: str = "visa", type: str = "Credit", last_digits: str = "1234", expiry_date: str = "12/30", limit: Decimal | str = Decimal("1000.00"), is_archived: bool = False, deleted_at=None):
        card = Card(
            id=card_id or str(uuid4()),
            user_id=user.id,
            holder_name=holder_name,
            brand=brand,
            type=type,
            last_digits=last_digits,
            expiry_date=expiry_date,
            limit=Decimal(str(limit)),
            is_archived=is_archived,
            deleted_at=deleted_at,
        )
        db_session.add(card)
        db_session.commit()
        db_session.refresh(card)
        return card

    return factory


@pytest.fixture
def make_group(db_session):
    def factory(owner: User, *, name: str = "Shared Group", members: tuple[User, ...] = ()):
        group = Group(name=name, created_by=owner.id)
        group.members.append(GroupMember(user_id=owner.id, role="owner"))
        for member in members:
            if member.id != owner.id:
                group.members.append(GroupMember(user_id=member.id, role="member"))
        db_session.add(group)
        db_session.commit()
        db_session.refresh(group)
        return group

    return factory


@pytest.fixture
def make_expense(db_session):
    def factory(
        user: User,
        *,
        expense_id: str | None = None,
        description: str = "Groceries",
        amount: Decimal | str = Decimal("25.00"),
        person: str = "Owner",
        date: datetime | None = None,
        tags: list[str] | None = None,
        paid: bool = False,
        source: str = "manual",
        card_id: str | None = None,
        group_id: str | None = None,
        deleted_at=None,
        updated_at: datetime | None = None,
    ):
        expense = Expense(
            id=expense_id or str(uuid4()),
            user_id=user.id,
            description=description,
            amount=Decimal(str(amount)),
            person=person,
            date=date or datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc),
            tags=tags or [],
            paid=paid,
            source=source,
            card_id=card_id,
            group_id=group_id,
            deleted_at=deleted_at,
        )
        if updated_at is not None:
            expense.updated_at = updated_at
        db_session.add(expense)
        db_session.commit()
        db_session.refresh(expense)
        return expense

    return factory
