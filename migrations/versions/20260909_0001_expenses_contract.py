"""Align the database with the expenses API contract.

Revision ID: 20260909_0001
Revises:
"""

from alembic import op
import sqlalchemy as sa


revision = "20260909_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "transactions" in tables and "expenses" not in tables:
        op.rename_table("transactions", "expenses")
        tables.remove("transactions")
        tables.add("expenses")

    if "expenses" in tables:
        columns = {column["name"] for column in sa.inspect(bind).get_columns("expenses")}
        if "source" not in columns:
            op.add_column("expenses", sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"))
        if "deleted_at" not in columns:
            op.add_column("expenses", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    if "pending_transactions" not in tables:
        op.create_table(
            "pending_transactions",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("institution", sa.String(length=100), nullable=True),
            sa.Column("raw_text", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("idx_pending_user", "pending_transactions", ["user_id"])

    if "expenses" in tables:
        op.create_index("idx_expenses_user_date", "expenses", ["user_id", "date"], if_not_exists=True)
        op.create_index("idx_expenses_user_person", "expenses", ["user_id", "person"], if_not_exists=True)
        op.create_index("idx_expenses_user_paid", "expenses", ["user_id", "paid"], if_not_exists=True)
        op.create_index("idx_expenses_user_deleted", "expenses", ["user_id", "deleted_at"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_expenses_user_deleted", table_name="expenses")
    op.drop_index("idx_expenses_user_paid", table_name="expenses")
    op.drop_index("idx_expenses_user_person", table_name="expenses")
    op.drop_index("idx_expenses_user_date", table_name="expenses")
    op.drop_table("pending_transactions")
    op.drop_column("expenses", "deleted_at")
    op.drop_column("expenses", "source")
    op.rename_table("expenses", "transactions")
