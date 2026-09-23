from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import CamelModel

PASSWORD_MIN = 8
PASSWORD_MAX = 128


def validate_password_strength(value: str) -> str:
    if len(value) < PASSWORD_MIN:
        raise ValueError(f"password must have at least {PASSWORD_MIN} characters")
    if value.isdigit() or value.isalpha():
        raise ValueError("password must mix letters and numbers")
    return value


class RegisterRequest(CamelModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)
    device_name: str | None = Field(default=None, max_length=120)

    _password = field_validator("password")(validate_password_strength)


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)
    device_name: str | None = Field(default=None, max_length=120)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class LogoutRequest(CamelModel):
    refresh_token: str | None = Field(default=None, max_length=200)
    all_devices: bool = False


class UserRead(CamelModel):
    id: str
    email: EmailStr
    name: str
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class UserUpdate(CamelModel):
    """Profile screen: change name, e-mail or avatar. Changing e-mail requires the current password."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    avatar_url: str | None = Field(default=None, max_length=500)
    current_password: str | None = Field(default=None, max_length=PASSWORD_MAX)


class PasswordChangeRequest(CamelModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX)
    new_password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)

    _password = field_validator("new_password")(validate_password_strength)


class AccountDeleteRequest(CamelModel):
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class TokenPair(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class AuthData(TokenPair):
    user: UserRead
