from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel

GroupRole = Literal["owner", "member"]


class GroupCreate(CamelModel):
    name: str = Field(min_length=1, max_length=120)


class GroupUpdate(CamelModel):
    name: str = Field(min_length=1, max_length=120)


class GroupMemberAdd(CamelModel):
    email: EmailStr


class GroupMemberRead(CamelModel):
    user_id: str
    name: str
    email: EmailStr
    role: GroupRole
    joined_at: datetime


class GroupRead(CamelModel):
    id: str
    name: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    members: list[GroupMemberRead]


class PersonBalance(CamelModel):
    person: str
    total: Decimal
    pending: Decimal
    paid: Decimal
    count: int


class GroupBalance(CamelModel):
    group_id: str
    total: Decimal
    pending: Decimal
    paid: Decimal
    per_person: list[PersonBalance]
