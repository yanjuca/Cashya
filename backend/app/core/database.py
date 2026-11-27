from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=not is_sqlite)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


if is_sqlite:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _):  # pragma: no cover - driver hook
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create missing tables and apply lightweight column upgrades for local databases.

    Production deployments should run `alembic upgrade head`; this keeps developer databases usable
    without a manual migration step.
    """
    from app import models  # noqa: F401

    _rename_legacy_transactions_table()
    Base.metadata.create_all(bind=engine)
    _upgrade_columns(
        "expenses",
        {
            "source": "VARCHAR(20) NOT NULL DEFAULT 'manual'",
            "deleted_at": "DATETIME NULL",
            "card_id": "VARCHAR(36) NULL REFERENCES cards(id) ON DELETE SET NULL",
            "group_id": "VARCHAR(36) NULL REFERENCES groups(id) ON DELETE SET NULL",
            "recurring": "BOOLEAN NOT NULL DEFAULT FALSE",
            "recurring_months": "INTEGER NULL",
            "recurring_source_id": "VARCHAR(36) NULL",
            "skipped_months": "JSON NOT NULL DEFAULT '[]'",
        },
    )
    _upgrade_columns(
        "users",
        {
            "avatar_url": "VARCHAR(500) NULL",
            "updated_at": "DATETIME NULL",
        },
    )


def _rename_legacy_transactions_table() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "transactions" not in tables or "expenses" in tables:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE transactions RENAME TO expenses"))


def _upgrade_columns(table: str, definitions: dict[str, str]) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns(table)}
    statements = [f"ALTER TABLE {table} ADD COLUMN {name} {ddl}" for name, ddl in definitions.items() if name not in columns]
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
