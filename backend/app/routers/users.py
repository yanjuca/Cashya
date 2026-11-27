from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.user import User
from app.schemas.auth import (
    AccountDeleteRequest,
    EmailPreferencesPatch,
    EmailPreferencesRead,
    PasswordChangeRequest,
    UserRead,
    UserUpdate,
)
from app.services.auth import (
    AuthError,
    change_password,
    create_email_challenge,
    delete_account,
    update_profile,
)
from app.services.mailer import (
    email_changed_email,
    password_changed_email,
    send_email_best_effort,
    verification_email,
)

router = APIRouter()


@router.get("/me", summary="Profile of the signed-in user")
def read_me(user: User = Depends(get_current_user)) -> dict:
    return envelope(UserRead.model_validate(user))


@router.patch("/me", summary="Update name, e-mail (requires currentPassword) or avatar")
def update_me(
    data: UserUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    old_email = user.email
    try:
        updated = update_profile(db, user, data)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    if updated.email != old_email:
        subject, body = email_changed_email(updated.name)
        background_tasks.add_task(send_email_best_effort, old_email, subject, body)
        if settings.email_configured:
            code = create_email_challenge(db, updated, "verify_email")
            subject, body = verification_email(updated.name, code)
            background_tasks.add_task(send_email_best_effort, updated.email, subject, body)
    return envelope(UserRead.model_validate(updated), "Profile updated")


@router.post("/me/change-password", summary="Change password; all other sessions are signed out")
def change_my_password(
    data: PasswordChangeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    try:
        change_password(db, user, data)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    subject, body = password_changed_email(user.name)
    background_tasks.add_task(send_email_best_effort, user.email, subject, body)
    return envelope(message="Password changed successfully. Sign in again on other devices.")


@router.get("/me/email-preferences", summary="Read the signed-in user's email verification and preferences")
def read_email_preferences(user: User = Depends(get_current_user)) -> dict:
    return envelope(EmailPreferencesRead.model_validate(user))


@router.patch("/me/email-preferences", summary="Update email notification and report preferences")
def update_email_preferences(
    data: EmailPreferencesPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    values = data.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=400, detail="At least one email preference must be provided")
    if any(value is None for value in values.values()):
        raise HTTPException(status_code=422, detail="Email preference values must be booleans")
    for key, value in values.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return envelope(EmailPreferencesRead.model_validate(user), "Email preferences updated")


@router.delete("/me", summary="Permanently delete the account and all its data")
def delete_me(data: AccountDeleteRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        delete_account(db, user, data.password)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return envelope(message="Account deleted")
