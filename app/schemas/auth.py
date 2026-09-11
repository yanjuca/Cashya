from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    email: EmailStr
    name: str
    created_at: datetime = Field(serialization_alias="createdAt")


class AuthData(BaseModel):
    user: UserRead
    token: str


class AuthResponse(BaseModel):
    success: bool = True
    data: AuthData
    message: str | None = None
