from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

CARD_BRANDS = ("visa", "mastercard", "elo", "generic")
CARD_TYPES = ("Credit", "Debit")
DEFAULT_CARD_COLOR = "#ff453a"


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        Index("idx_cards_user_deleted", "user_id", "deleted_at"),
        Index("idx_cards_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    holder_name: Mapped[str] = mapped_column(String(120))
    brand: Mapped[str] = mapped_column(String(20), default="generic")
    type: Mapped[str] = mapped_column(String(10), default="Credit")
    last_digits: Mapped[str] = mapped_column(String(4))
    expiry_date: Mapped[str] = mapped_column(String(5))
    limit: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), default=Decimal("0"))
    color_accent: Mapped[str] = mapped_column(String(9), default=DEFAULT_CARD_COLOR)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="cards")
    expenses = relationship("Expense", back_populates="card")
