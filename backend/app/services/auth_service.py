"""
Authentication service — registration, login, session management.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, hash_token
from app.models.models import User, UserSession, TourProgress, AuditEvent
from app.schemas.schemas import RegisterRequest, LoginRequest, FirebaseLoginRequest


class AuthService:
    def register(self, db: Session, req: RegisterRequest, ip_address: Optional[str] = None) -> User:
        existing = db.query(User).filter(User.email == req.email.lower()).first()
        if existing:
            raise ValueError("Email already registered")

        # Allow user to select role (admin, officer, applicant, viewer, user)
        selected_role = (req.role or "applicant").lower().strip()
        if selected_role not in ["admin", "officer", "applicant", "viewer", "user"]:
            selected_role = "applicant"

        user = User(
            email=req.email.lower(),
            hashed_password=hash_password(req.password),
            full_name=req.full_name,
            organization=req.organization,
            role=selected_role,
        )
        db.add(user)
        db.flush()
        # Initialize tour progress
        tour = TourProgress(user_id=user.id)
        db.add(tour)
        # Audit
        db.add(AuditEvent(
            user_id=user.id,
            event_type="user_registered",
            resource_type="user",
            resource_id=user.id,
            description=f"New user registered: {user.email} (Role: {selected_role})",
            ip_address=ip_address,
        ))
        db.commit()
        db.refresh(user)
        return user

    def login(self, db: Session, req: LoginRequest, ip_address: Optional[str] = None):
        user = db.query(User).filter(User.email == req.email.lower()).first()
        now = datetime.now(timezone.utc)

        if not user or not user.is_active:
            self._audit_failed_login(db, req.email, ip_address)
            raise ValueError("Invalid credentials")

        # Check rate limit
        if user.login_locked_until and user.login_locked_until > now:
            wait = int((user.login_locked_until - now).total_seconds())
            raise ValueError(f"Account temporarily locked. Try again in {wait} seconds.")

        if not verify_password(req.password, user.hashed_password):
            user.login_attempts = (user.login_attempts or 0) + 1
            if user.login_attempts >= settings.login_rate_limit_attempts:
                user.login_locked_until = now + timedelta(seconds=settings.login_rate_limit_window_seconds)
            db.commit()
            self._audit_failed_login(db, req.email, ip_address)
            raise ValueError("Invalid credentials")

        # Reset rate limiting on success
        user.login_attempts = 0
        user.login_locked_until = None
        user.last_login_at = now

        # Create token
        token = create_access_token(user.id, user.role)
        expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

        session = UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=expires_at,
            ip_address=ip_address,
        )
        db.add(session)

        db.add(AuditEvent(
            user_id=user.id,
            event_type="user_login",
            resource_type="user",
            resource_id=user.id,
            description=f"User logged in: {user.email}",
            ip_address=ip_address,
        ))
        db.commit()
        return user, token, int(settings.jwt_access_token_expire_minutes * 60)

    def firebase_login(self, db: Session, req: FirebaseLoginRequest, ip_address: Optional[str] = None):
        """
        Authenticate or register a user through Firebase Auth.
        Honors any specified role (admin, officer, applicant, viewer, user).
        """
        email_clean = req.email.lower().strip()
        user = db.query(User).filter(User.email == email_clean).first()
        now = datetime.now(timezone.utc)

        selected_role = (req.role or "applicant").lower().strip()
        if selected_role not in ["admin", "officer", "applicant", "viewer", "user"]:
            selected_role = "applicant"

        if not user:
            # Create user linked to Firebase
            display_name = req.full_name or email_clean.split("@")[0].capitalize()
            dummy_pwd = f"firebase_oauth_{req.firebase_uid or email_clean}"
            user = User(
                email=email_clean,
                hashed_password=hash_password(dummy_pwd),
                full_name=display_name,
                organization=req.organization or "EcoSentinel User",
                role=selected_role,
            )
            db.add(user)
            db.flush()
            # Initialize tour progress
            tour = TourProgress(user_id=user.id, completed=False)
            db.add(tour)
            db.add(AuditEvent(
                user_id=user.id,
                event_type="user_registered_firebase",
                resource_type="user",
                resource_id=user.id,
                description=f"New Firebase user created: {user.email} (Role: {selected_role})",
                ip_address=ip_address,
            ))
        else:
            # User already exists - update role if specifically passed
            if req.role and req.role.lower().strip() in ["admin", "officer", "applicant", "viewer", "user"]:
                user.role = req.role.lower().strip()
            if req.full_name and not user.full_name:
                user.full_name = req.full_name
            if req.organization and not user.organization:
                user.organization = req.organization

        # Reset rate limiting & unlock
        user.login_attempts = 0
        user.login_locked_until = None
        user.last_login_at = now

        # Create JWT token with user's role
        token = create_access_token(user.id, user.role)
        expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

        session = UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=expires_at,
            ip_address=ip_address,
        )
        db.add(session)

        db.add(AuditEvent(
            user_id=user.id,
            event_type="firebase_login",
            resource_type="user",
            resource_id=user.id,
            description=f"User signed in via Firebase: {user.email} (Role: {user.role})",
            ip_address=ip_address,
        ))
        db.commit()
        return user, token, int(settings.jwt_access_token_expire_minutes * 60)

    def logout(self, db: Session, token: str, user: User):
        token_hash = hash_token(token)
        session = db.query(UserSession).filter(UserSession.token_hash == token_hash).first()
        if session:
            session.invalidated_at = datetime.now(timezone.utc)
            db.commit()
        db.add(AuditEvent(
            user_id=user.id,
            event_type="user_logout",
            resource_type="user",
            resource_id=user.id,
            description=f"User logged out: {user.email}",
        ))
        db.commit()

    def create_admin(self, db: Session, email: str, password: str, full_name: str) -> User:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            raise ValueError("Email already registered")
        user = User(
            email=email.lower(),
            hashed_password=hash_password(password),
            full_name=full_name,
            role="admin",
        )
        db.add(user)
        db.flush()
        tour = TourProgress(user_id=user.id, completed=True)
        db.add(tour)
        db.commit()
        db.refresh(user)
        return user

    def _audit_failed_login(self, db: Session, email: str, ip_address: Optional[str]):
        db.add(AuditEvent(
            event_type="login_failed",
            resource_type="user",
            description=f"Failed login attempt for: {email}",
            ip_address=ip_address,
        ))
        db.commit()


auth_service = AuthService()
