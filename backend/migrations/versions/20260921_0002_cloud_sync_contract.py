"""Cards, groups, refresh tokens and profile fields for the cloud sync contract.

Revision ID: 20260921_0002
Revises: 20260909_0001
"""

from alembic import op
import sqlalchemy as sa


revision = "20260921_0002"
down_revision = "20260909_0001"
branch_labels = None
depends_on = None


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "cards" not in tables:
        op.create_table(
            "cards",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("holder_name", sa.String(length=120), nullable=False),
            sa.Column("brand", sa.String(length=20), nullable=False, server_default="generic"),
            sa.Column("type", sa.String(length=10), nullable=False, server_default="Credit"),
            sa.Column("last_digits", sa.String(length=4), nullable=False),
            sa.Column("expiry_date", sa.String(length=5), nullable=False),
            sa.Column("limit", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("color_accent", sa.String(length=9), nullable=False, server_default="#ff453a"),
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_cards_user_id", "cards", ["user_id"])
        op.create_index("idx_cards_user_deleted", "cards", ["user_id", "deleted_at"])
        op.create_index("idx_cards_user_updated", "cards", ["user_id", "updated_at"])

    if "groups" not in tables:
        op.create_table(
            "groups",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("created_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_groups_created_by", "groups", ["created_by"])

    if "group_members" not in tables:
        op.create_table(
            "group_members",
            sa.Column("group_id", sa.String(length=36), sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("role", sa.String(length=10), nullable=False, server_default="member"),
            sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_group_members_user_id", "group_members", ["user_id"])

    if "refresh_tokens" not in tables:
        op.create_table(
            "refresh_tokens",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("replaced_by", sa.String(length=36), nullable=True),
            sa.Column("device_name", sa.String(length=120), nullable=True),
        )
        op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
        op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    user_columns = _columns(bind, "users")
    with op.batch_alter_table("users") as batch:
        if "avatar_url" not in user_columns:
            batch.add_column(sa.Column("avatar_url", sa.String(length=500), nullable=True))
        if "updated_at" not in user_columns:
            batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    expense_columns = _columns(bind, "expenses")
    with op.batch_alter_table("expenses") as batch:
        if "card_id" not in expense_columns:
            batch.add_column(sa.Column("card_id", sa.String(length=36), nullable=True))
            batch.create_foreign_key("fk_expenses_card_id", "cards", ["card_id"], ["id"], ondelete="SET NULL")
        if "group_id" not in expense_columns:
            batch.add_column(sa.Column("group_id", sa.String(length=36), nullable=True))
            batch.create_foreign_key("fk_expenses_group_id", "groups", ["group_id"], ["id"], ondelete="SET NULL")
        if "category_id" in expense_columns:
            batch.drop_column("category_id")

    op.create_index("idx_expenses_user_updated", "expenses", ["user_id", "updated_at"], if_not_exists=True)
    op.create_index("idx_expenses_group_date", "expenses", ["group_id", "date"], if_not_exists=True)
    op.create_index("idx_expenses_card", "expenses", ["card_id"], if_not_exists=True)

    # Categories and budgets were replaced by free-form tags in the new contract.
    if "budgets" in tables:
        op.drop_table("budgets")
    if "categories" in tables:
        op.drop_table("categories")


def downgrade() -> None:
    op.drop_index("idx_expenses_card", table_name="expenses")
    op.drop_index("idx_expenses_group_date", table_name="expenses")
    op.drop_index("idx_expenses_user_updated", table_name="expenses")
    with op.batch_alter_table("expenses") as batch:
        batch.drop_column("group_id")
        batch.drop_column("card_id")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("updated_at")
        batch.drop_column("avatar_url")
    op.drop_table("refresh_tokens")
    op.drop_table("group_members")
    op.drop_table("groups")
    op.drop_table("cards")
