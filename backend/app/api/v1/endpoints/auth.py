import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cookies import clear_auth_cookies, set_auth_cookies
from app.core.csrf import generate_csrf_token, set_csrf_cookie, validate_csrf
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_testing_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.admin_notification import AdminNotification
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.schemas.user import TokenResponse, UserCreate, UserLogin
from app.services.account_security_email import find_valid_action_token, issue_action_token, send_password_reset_email
from app.services.auth_session import (
    RefreshTokenConcurrentUseError,
    RefreshTokenReuseError,
    create_user_session,
    revoke_user_session,
    rotate_user_session,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class ForgotPasswordPayload(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if value.strip() != value:
            raise ValueError("Password cannot start or end with spaces")
        if not any(char.isupper() for char in value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(char.islower() for char in value):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one number")
        return value


PUBLIC_ACCOUNT_ROLES = {UserRole.student, UserRole.teacher, UserRole.parent}


@router.get("/csrf")
def get_csrf_token(response: Response):
    # The token is returned in JSON because the API and frontend may live on
    # different hosts. The matching cookie remains scoped to the API host.
    token = generate_csrf_token()
    set_csrf_cookie(response, token)
    return {"csrf_token": token}


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(
    request: Request,
    response: Response,
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    validate_csrf(request)

    if payload.role in {UserRole.admin, UserRole.super_admin}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created through public signup",
        )

    email = payload.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    phone = payload.phone.strip()
    if phone and db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        full_name=payload.full_name.strip(),
        phone=phone,
        email_verified=True,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if payload.role == UserRole.teacher:
        db.add(TeacherProfile(user_id=user.id))
    elif payload.role == UserRole.student:
        db.add(StudentProfile(user_id=user.id))

    db.commit()
    db.refresh(user)

    # Notifications are deliberately best-effort and must not break signup.
    if payload.role == UserRole.student:
        try:
            db.add(AdminNotification(
                notification_type="student_registration",
                title="New student registration",
                message=f"{user.full_name} ({user.email}) has registered as a new student.",
                student_id=user.id,
            ))
            db.commit()
        except Exception:
            db.rollback()

    refresh_token = create_user_session(db=db, user_id=user.id)
    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    db.commit()
    set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(user=user)


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    response: Response,
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    refresh_token = create_user_session(db=db, user_id=user.id)
    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    db.commit()
    set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(user=user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    token_hash = hash_refresh_token(refresh_token)
    session = db.query(UserSession).filter(UserSession.refresh_token_hash == token_hash).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    try:
        new_refresh_token = rotate_user_session(db=db, refresh_token=refresh_token, user_id=user.id)
    except RefreshTokenConcurrentUseError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Refresh token rotation in progress; retry with the latest cookie")
    except RefreshTokenReuseError:
        # Persist family-wide revocation before returning an authentication error.
        db.commit()
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    db.commit()
    set_auth_cookies(response, access_token, new_refresh_token)
    return TokenResponse(user=user)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    if refresh_token:
        revoke_user_session(db=db, refresh_token=refresh_token)
        db.commit()
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.post("/testing-token")
def get_testing_token(
    current_user: User = Depends(get_current_user),
):
    # The testing service is a separate host, so it cannot read the API host's
    # host-only HttpOnly cookie. Give the browser a short-lived, in-memory-only
    # bearer token scoped to that service instead of persisting the main token.
    token = create_testing_access_token(str(current_user.id), current_user.role.value)
    return {"access_token": token, "expires_in": settings.TESTING_ACCESS_TOKEN_EXPIRE_MINUTES * 60}



@router.post("/password/forgot")
def forgot_password(
    request: Request,
    payload: ForgotPasswordPayload,
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    # Always return the same response to avoid disclosing which email addresses
    # have Dexmy accounts. Password recovery is limited to student/teacher/parent.
    email = str(payload.email).lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user and user.role in PUBLIC_ACCOUNT_ROLES and settings.SMTP_PASSWORD:
        try:
            token = issue_action_token(db, user_id=user.id, purpose="password_reset", lifetime_minutes=60)
            db.commit()
            send_password_reset_email(user.email, user.full_name, token)
        except Exception:
            db.rollback()
            logger.exception("Unable to process a password recovery email")
    return {"message": "If an eligible Dexmy account exists for that email, password recovery instructions will be sent shortly."}


@router.post("/password/reset")
def reset_password(
    request: Request,
    response: Response,
    payload: ResetPasswordPayload,
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    action = find_valid_action_token(db, payload.token, "password_reset")
    if action is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This password reset link is invalid or has expired.")
    user = db.get(User, action.user_id)
    if user is None or user.role not in PUBLIC_ACCOUNT_ROLES or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This password reset link is invalid or has expired.")

    now = datetime.now(timezone.utc)
    action.used_at = now
    user.password_hash = hash_password(payload.new_password)
    # Revoke all refresh sessions so a password reset signs out other devices.
    db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)
    db.commit()
    clear_auth_cookies(response)
    return {"message": "Password reset successfully. Please log in with your new password."}
