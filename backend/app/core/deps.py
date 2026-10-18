"""
FastAPI dependency injection for authentication and authorization.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Request, status, Cookie
from sqlalchemy.orm import Session
import jwt

from app.core.database import get_db
from app.core.security import decode_access_token, hash_token
from app.models.models import User, UserSession


def get_token_from_request(request: Request) -> Optional[str]:
    """Extract bearer token from Authorization header or httponly cookie."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    # Check cookie
    return request.cookies.get("access_token")


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = get_token_from_request(request)
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None



def require_role(*roles: str):
    async def _check(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {roles}",
            )
        return current_user
    return _check


require_admin = require_role("admin")
require_officer_or_admin = require_role("admin", "officer")
require_authenticated = get_current_user


def check_project_access(project, user: User, require_write: bool = False) -> bool:
    """Check if user can access the project."""
    if user.role == "admin":
        return True
    if user.role == "officer":
        return True
    # Reference/demo investigation is readable by all users
    if not require_write and (
        project.id == "demo-mayawana-ketapang-west-kalimantan-002" or
        "Mayawana" in project.project_name or
        project.analysis_mode == "REPLAY"
    ):
        return True
    if user.role == "applicant":
        if require_write:
            return project.owner_id == user.id
        return project.owner_id == user.id
    if user.role == "viewer":
        return not require_write
    return False
