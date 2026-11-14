"""Email verification, preferences, reset codes and scheduled delivery tracking.

Revision ID: 20261114_0003
Revises: 20260921_0002
"""

from alembic import op
import sqlalchemy as sa


revision = "20261114_0003"
down_revision = "20260921_0002"
branch_labels = None
depends_on = None


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    user_columns = _columns(bind, "users")
    with op.batch_alter_table("users") as batch:
        if "email_verified" not in user_columns:
            batch.add_column(sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "email_notifications_enabled" not in user_columns:
            batch.add_column(sa.Column("email_notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
        if "email_reports_enabled" not in user_columns:
            batch.add_column(sa.Column("email_reports_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))

    tables = set(sa.inspect(bind).get_table_names())
    if "email_challenges" not in tables:
        op.create_table(
            "email_challenges",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("purpose", sa.String(length=32), nullable=False),
            sa.Column("code_hash", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        )
        op.create_index("ix_email_challenges_user_id", "email_challenges", ["user_id"])
        op.create_index("idx_email_challenges_user_purpose", "email_challenges", ["user_id", "purpose", "created_at"])

    if "email_deliveries" not in tables:
        op.create_table(
            "email_deliveries",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("kind", sa.String(length=40), nullable=False),
            sa.Column("period_key", sa.String(length=20), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="sending"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error", sa.String(length=200), nullable=True),
            sa.UniqueConstraint("user_id", "kind", "period_key", name="uq_email_deliveries_user_kind_period"),
        )
        op.create_index("ix_email_deliveries_user_id", "email_deliveries", ["user_id"])
        op.create_index("idx_email_deliveries_status_updated", "email_deliveries", ["status", "updated_at"])


def downgrade() -> None:
    op.drop_table("email_deliveries")
    op.drop_table("email_challenges")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("email_reports_enabled")
        batch.drop_column("email_notifications_enabled")
        batch.drop_column("email_verified")
