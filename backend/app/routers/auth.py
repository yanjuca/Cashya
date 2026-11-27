from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.user import User
from app.schemas.auth import (
    AuthData,
    EmailVerificationConfirm,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    UserRead,
)
from app.services.auth import (
    AuthError,
    authenticate_user,
    create_email_challenge,
    find_user_by_email,
    issue_token_pair,
    register_user,
    reset_password_with_code,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_email_address,
)
from app.services.email_dispatch import send_first_card_nudge
from app.services.mailer import (
    password_changed_email,
    password_reset_email,
    send_email_best_effort,
    verification_email,
)

router = APIRouter()


def auth_payload(db: Session, user: User, device_name: str | None) -> AuthData:
    pair = issue_token_pair(db, user, device_name)
    return AuthData(**pair.model_dump(), user=UserRead.model_validate(user))


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Create an account (e-mail + password)")
def register(
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    try:
        user = register_user(db, data)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    if settings.email_configured:
        code = create_email_challenge(db, user, "verify_email")
        subject, body = verification_email(user.name, code)
        background_tasks.add_task(send_email_best_effort, user.email, subject, body)
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


@router.post("/password-reset/request", summary="Send a password reset code without revealing account existence")
def request_password_reset(
    data: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    user = find_user_by_email(db, data.email)
    if user is not None and settings.email_configured:
        code = create_email_challenge(db, user, "password_reset")
        subject, body = password_reset_email(user.name, code)
        background_tasks.add_task(send_email_best_effort, data.email, subject, body)
    return envelope(message="If an account exists for that address, a reset code will be sent")


@router.post("/password-reset/confirm", summary="Set a new password with a one-time reset code")
def confirm_password_reset(
    data: PasswordResetConfirm,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    try:
        user = reset_password_with_code(db, data.email, data.code, data.new_password)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    subject, body = password_changed_email(user.name)
    background_tasks.add_task(send_email_best_effort, user.email, subject, body)
    return envelope(message="Password changed successfully. Sign in again on your devices.")


@router.post("/email-verification/request", summary="Send a verification code to the signed-in user's address")
def request_email_verification(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.email_verified:
        return envelope(message="Email address is already verified")
    if not settings.email_configured:
        raise HTTPException(status_code=503, detail="Email delivery is not configured")
    code = create_email_challenge(db, user, "verify_email")
    subject, body = verification_email(user.name, code)
    background_tasks.add_task(send_email_best_effort, user.email, subject, body)
    return envelope(message="A verification code has been sent")


@router.post("/email-verification/confirm", summary="Verify the signed-in user's email with a one-time code")
def confirm_email_verification(
    data: EmailVerificationConfirm,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    try:
        verify_email_address(db, user, data.code)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    background_tasks.add_task(send_first_card_nudge, user.id)
    return envelope(message="Email address verified")


@router.get("/me", summary="Alias of GET /users/me kept for older clients")
def me(user: User = Depends(get_current_user)) -> dict:
    return envelope(UserRead.model_validate(user))
