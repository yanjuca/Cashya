from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import AuthResponse, UserCreate, UserLogin, UserRead
from app.services.auth import authenticate_user, issue_token, register_user

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = register_user(db, data)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return AuthResponse(data={"token": issue_token(user), "user": user}, message="Account created successfully")


@router.post("/login", response_model=AuthResponse)
def login(data: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    user = authenticate_user(db, data)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return AuthResponse(data={"token": issue_token(user), "user": user})


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return {"success": True, "data": UserRead.model_validate(user).model_dump(by_alias=True)}
