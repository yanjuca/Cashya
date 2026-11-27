from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

GROUP_ROLES = ("owner", "member")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String(10), default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")
