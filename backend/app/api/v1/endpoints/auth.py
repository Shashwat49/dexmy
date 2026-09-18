import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth_cookies import clear_auth_cookies, set_auth_cookies
from app.core.config import settings
from app.core.csrf import create_csrf_token, validate_csrf
from app.core.security import verify_password, hash_password
from app.db.session import get_db
from app.models.session import UserSession
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.services.auth_session import (
    create_auth_session,
    get_session_by_refresh_token,
    revoke_all_user_sessions,
    revoke_session,
)


router = APIRouter()


@router.post(
    "/signup",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    payload: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    # Public signup can never create an admin account.
    if payload.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created through public signup",
        )

    email = payload.email.lower().strip()

    # Duplicate email
    existing_email = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Duplicate phone
    phone = payload.phone.strip()

    if phone:
        existing_phone = (
            db.query(User)
            .filter(User.phone == phone)
            .first()
        )

        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already registered",
        )

    # Create user
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

    # Create role-specific profile
    if payload.role == UserRole.teacher:
        db.add(
            TeacherProfile(
                user_id=user.id,
            )
        )

    elif payload.role == UserRole.student:
        db.add(
            StudentProfile(
                user_id=user.id,
            )
        )

    db.flush()

    # Create server-side authentication session.
    (
        access_token,
        refresh_token,
        access_expires_at,
        refresh_expires_at,
    ) = create_auth_session(db, user)

    csrf_token = create_csrf_token()

    db.commit()
    db.refresh(user)

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        access_expires_at=access_expires_at,
        refresh_expires_at=refresh_expires_at,
    )

    return user


@router.post(
    "/login",
    response_model=UserRead,
)
def login(
    payload: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    (
        access_token,
        refresh_token,
        access_expires_at,
        refresh_expires_at,
    ) = create_auth_session(db, user)

    csrf_token = create_csrf_token()

    db.commit()

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        access_expires_at=access_expires_at,
        refresh_expires_at=refresh_expires_at,
    )

    return user


@router.post(
    "/refresh",
    response_model=UserRead,
)
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(
        default=None,
        alias=settings.REFRESH_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
):
    validate_csrf(request)

    if not refresh_token:
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh authentication required",
        )

    session = get_session_by_refresh_token(
        db=db,
        refresh_token=refresh_token,
    )

    now = datetime.now(timezone.utc)

    if session is None:
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh credential",
        )

    # A refresh token that belongs to a revoked session must never
    # become valid again. Treat reuse as a potential replay attack.
    if session.revoked_at is not None:
        revoke_all_user_sessions(db, session.user_id)
        db.commit()
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh credential has been revoked",
        )

    if session.expires_at <= now:
        revoke_session(db, session)
        db.commit()
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh credential has expired",
        )

    user = db.get(User, session.user_id)

    if user is None or not user.is_active:
        revoke_session(db, session)
        db.commit()
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Rotate the refresh credential.
    revoke_session(db, session)

    (
        access_token,
        new_refresh_token,
        access_expires_at,
        refresh_expires_at,
    ) = create_auth_session(db, user)

    csrf_token = create_csrf_token()

    db.commit()

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=new_refresh_token,
        csrf_token=csrf_token,
        access_expires_at=access_expires_at,
        refresh_expires_at=refresh_expires_at,
    )

    return user


@router.post(
    "/logout",
    response_model=dict,
)
def logout(
    request: Request,
    response: Response,
    access_token: str | None = Cookie(
        default=None,
        alias=settings.ACCESS_COOKIE_NAME,
    ),
    refresh_token: str | None = Cookie(
        default=None,
        alias=settings.REFRESH_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
):
    validate_csrf(request)

    session: UserSession | None = None

    # Prefer the refresh session because it directly maps to the
    # server-side authentication session.
    if refresh_token:
        session = get_session_by_refresh_token(
            db=db,
            refresh_token=refresh_token,
        )

    # If refresh cookie is already unavailable, the access JWT can
    # still identify the session.
    if session is None and access_token:
        from app.core.security import decode_access_token
        from jose import JWTError

        try:
            payload = decode_access_token(access_token)
            session_id = uuid.UUID(payload["sid"])
            user_id = uuid.UUID(payload["sub"])

            session = db.scalar(
                select(UserSession).where(
                    UserSession.id == session_id,
                    UserSession.user_id == user_id,
                )
            )
        except (JWTError, KeyError, ValueError, TypeError):
            session = None

    if session is not None:
        revoke_session(db, session)

    db.commit()

    clear_auth_cookies(response)

    return {"message": "Logged out successfully"}