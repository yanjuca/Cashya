from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin


def register_user(db: Session, data: UserCreate) -> User:
    existing = db.scalar(select(User).where(func.lower(User.email) == data.email.lower()))
    if existing:
        raise ValueError("An account with this email already exists")
    user = User(email=data.email.lower(), name=data.name.strip(), password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: UserLogin) -> User | None:
    user = db.scalar(select(User).where(func.lower(User.email) == data.email.lower()))
    if user is None or not verify_password(data.password, user.password_hash) or not user.is_active:
        return None
    return user


def issue_token(user: User) -> str:
    return create_access_token(user.id)
