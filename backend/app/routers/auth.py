from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.user import User
from app.schemas.auth import AuthData, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, UserRead
from app.services.auth import AuthError, authenticate_user, issue_token_pair, register_user, revoke_all_refresh_tokens, revoke_refresh_token, rotate_refresh_token

router = APIRouter()


def auth_payload(db: Session, user: User, device_name: str | None) -> AuthData:
    pair = issue_token_pair(db, user, device_name)
    return AuthData(**pair.model_dump(), user=UserRead.model_validate(user))


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Create an account (e-mail + password)")
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    try:
        user = register_user(db, data)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return envelope(auth_payload(db, user, data.device_name), "Account created successfully")


@router.post("/login", summary="Authenticate and receive accessToken + refreshToken")
def login(data: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = authenticate_user(db, data)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return envelope(auth_payload(db, user, data.device_name))


@router.post("/refresh", summary="Exchange a refresh token for a new token pair (rotation)")
def refresh(data: RefreshRequest, db: Session = Depends(get_db)) -> dict:
    try:
        user, pair = rotate_refresh_token(db, data.refresh_token)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return envelope(AuthData(**pair.model_dump(), user=UserRead.model_validate(user)))


@router.post("/logout", summary="Revoke the refresh token of this device (or of all devices)")
def logout(data: LogoutRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if data.all_devices:
        revoke_all_refresh_tokens(db, user.id)
        return envelope(message="Signed out from all devices")
    if data.refresh_token:
        revoke_refresh_token(db, user, data.refresh_token)
    return envelope(message="Signed out")


@router.get("/me", summary="Alias of GET /users/me kept for older clients")
def me(user: User = Depends(get_current_user)) -> dict:
    return envelope(UserRead.model_validate(user))
