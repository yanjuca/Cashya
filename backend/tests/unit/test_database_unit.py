from sqlalchemy import create_engine, inspect, text

from app import models  # noqa: F401 - register models before create_tables
from app.core import database


def test_rename_legacy_transactions_table_when_expenses_table_is_absent(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE transactions (id INTEGER PRIMARY KEY)"))
    monkeypatch.setattr(database, "engine", engine)
    try:
        database._rename_legacy_transactions_table()
        names = set(inspect(engine).get_table_names())
        assert "expenses" in names
        assert "transactions" not in names
    finally:
        engine.dispose()


def test_rename_legacy_transactions_table_does_not_overwrite_existing_expenses(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE transactions (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE expenses (id INTEGER PRIMARY KEY)"))
    monkeypatch.setattr(database, "engine", engine)
    try:
        database._rename_legacy_transactions_table()
        names = set(inspect(engine).get_table_names())
        assert {"expenses", "transactions"} <= names
    finally:
        engine.dispose()


def test_upgrade_columns_adds_only_missing_columns():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        original_engine = database.engine
        database.engine = engine
        try:
            database._upgrade_columns(
                "users",
                {"avatar_url": "VARCHAR(500) NULL", "updated_at": "DATETIME NULL"},
            )
            database._upgrade_columns("users", {"avatar_url": "VARCHAR(500) NULL"})
        finally:
            database.engine = original_engine
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
        assert {"id", "avatar_url", "updated_at"} <= columns
    finally:
        engine.dispose()


def test_upgrade_columns_ignores_missing_table(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(database, "engine", engine)
    try:
        database._upgrade_columns("not_created", {"extra": "VARCHAR(20) NULL"})
        assert "not_created" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_create_tables_creates_all_registered_tables(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(database, "engine", engine)
    try:
        database.create_tables()
        table_names = set(inspect(engine).get_table_names())
        assert {
            "users",
            "cards",
            "expenses",
            "groups",
            "group_members",
            "refresh_tokens",
            "pending_transactions",
        } <= table_names
    finally:
        engine.dispose()
