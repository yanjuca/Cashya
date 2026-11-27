from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmailChallenge(Base):
    __tablename__ = "email_challenges"
    __table_args__ = (
        Index("idx_email_challenges_user_purpose", "user_id", "purpose", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(32))
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
