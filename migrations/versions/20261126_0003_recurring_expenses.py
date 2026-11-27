"""Recurring expense fields used by the mobile app.

Revision ID: 20261126_0003
Revises: 20260921_0002
"""

from alembic import op
import sqlalchemy as sa


revision = "20261126_0003"
down_revision = "20260921_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("expenses")}
    with op.batch_alter_table("expenses") as batch:
        if "recurring" not in columns:
            batch.add_column(sa.Column("recurring", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "recurring_months" not in columns:
            batch.add_column(sa.Column("recurring_months", sa.Integer(), nullable=True))
        if "recurring_source_id" not in columns:
            batch.add_column(sa.Column("recurring_source_id", sa.String(length=36), nullable=True))
        if "skipped_months" not in columns:
            batch.add_column(sa.Column("skipped_months", sa.JSON(), nullable=False, server_default="[]"))
    op.create_index("idx_expenses_recurring_source", "expenses", ["recurring_source_id"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_expenses_recurring_source", table_name="expenses")
    with op.batch_alter_table("expenses") as batch:
        batch.drop_column("skipped_months")
        batch.drop_column("recurring_source_id")
        batch.drop_column("recurring_months")
        batch.drop_column("recurring")
