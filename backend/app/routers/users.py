from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.user import User
from app.schemas.auth import AccountDeleteRequest, PasswordChangeRequest, UserRead, UserUpdate
from app.services.auth import AuthError, change_password, delete_account, update_profile

router = APIRouter()


@router.get("/me", summary="Profile of the signed-in user")
def read_me(user: User = Depends(get_current_user)) -> dict:
    return envelope(UserRead.model_validate(user))


@router.patch("/me", summary="Update name, e-mail (requires currentPassword) or avatar")
def update_me(data: UserUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        updated = update_profile(db, user, data)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return envelope(UserRead.model_validate(updated), "Profile updated")


@router.post("/me/change-password", summary="Change password; all other sessions are signed out")
def change_my_password(data: PasswordChangeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        change_password(db, user, data)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return envelope(message="Password changed successfully. Sign in again on other devices.")


@router.delete("/me", summary="Permanently delete the account and all its data")
def delete_me(data: AccountDeleteRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        delete_account(db, user, data.password)
    except AuthError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return envelope(message="Account deleted")
