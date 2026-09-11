from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    from app import models  # noqa: F401

    _rename_legacy_transactions_table()
    Base.metadata.create_all(bind=engine)
    _upgrade_transaction_columns()


def _rename_legacy_transactions_table() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "transactions" not in tables or "expenses" in tables:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE transactions RENAME TO expenses"))


def _upgrade_transaction_columns() -> None:
    columns = {column["name"] for column in inspect(engine).get_columns("expenses")}
    statements = []
    if "source" not in columns:
        statements.append("ALTER TABLE expenses ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'")
    if "deleted_at" not in columns:
        statements.append("ALTER TABLE expenses ADD COLUMN deleted_at DATETIME NULL")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
