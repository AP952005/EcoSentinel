"""
Authentication API endpoints.
"""
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_token
from app.schemas.schemas import (
    RegisterRequest, LoginRequest, FirebaseLoginRequest, TokenResponse, UserPublic, ChangePasswordRequest
)
from app.services.auth_service import auth_service
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    try:
        user = auth_service.register(db, req, ip_address=get_client_ip(request))
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        user, token, expires_in = auth_service.login(db, req, ip_address=get_client_ip(request))
        # Set httponly cookie
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            samesite="lax",
            max_age=expires_in,
            secure=settings.app_env == "production",
        )
        return TokenResponse(
            access_token=token,
            expires_in=expires_in,
            user=UserPublic.model_validate(user),
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/firebase-login", response_model=TokenResponse)
def firebase_login(req: FirebaseLoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        user, token, expires_in = auth_service.firebase_login(db, req, ip_address=get_client_ip(request))
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            samesite="lax",
            max_age=expires_in,
            secure=settings.app_env == "production",
        )
        return TokenResponse(
            access_token=token,
            expires_in=expires_in,
            user=UserPublic.model_validate(user),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    from app.core.deps import get_token_from_request
    token = get_token_from_request(request)
    if token:
        try:
            user = get_current_user.__wrapped__ if hasattr(get_current_user, '__wrapped__') else None
        except Exception:
            pass
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
