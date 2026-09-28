from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.user import TokenResponse, UserCreate, UserLogin
from app.core.config import settings
from app.core.cookies import clear_auth_cookies, set_auth_cookies
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
    hash_refresh_token,
)
from app.services.auth_session import (
    RefreshTokenReuseError,
    create_user_session,
    revoke_user_session,
    rotate_user_session,
)
from app.models.user_session import UserSession
from app.core.csrf import generate_csrf_token , validate_csrf

router = APIRouter()


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    request: Request,
    response: Response,
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    # ---------------------------------------------------------
    # Public signup can never create an admin account.
    # ---------------------------------------------------------

    if payload.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created through public signup",
        )

    email = payload.email.lower().strip()

    # ---------------------------------------------------------
    # Duplicate email
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # Duplicate phone
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # Create user
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # Create role-specific profile
    # ---------------------------------------------------------

    if payload.role == UserRole.teacher:
        db.add(
            TeacherProfile(
                user_id=user.id
            )
        )

    elif payload.role == UserRole.student:
        db.add(
            StudentProfile(
                user_id=user.id
            )
        )

    # ---------------------------------------------------------
    # Parent currently does not need a separate profile table.
    # Their profile is represented by the users table.
    # ---------------------------------------------------------

    db.commit()
    db.refresh(user)

    # ---------------------------------------------------------
    # Create JWT
    # ---------------------------------------------------------

    access_token = create_access_token(
    subject=str(user.id),
    role=user.role.value,
    )

    refresh_token = create_user_session(
    db=db,
    user_id=user.id,
    )

    db.commit()
    set_auth_cookies(
    response=response,
    access_token=access_token,
    refresh_token=refresh_token,
    )

    return TokenResponse(
    user=user,
)


@router.post(
        "/login",
        response_model=TokenResponse,
)

def login(
    request: Request,
    response: Response,
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    validate_csrf(request)

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
    access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
    )

    refresh_token = create_user_session(
        db=db,
        user_id=user.id,
    )

    db.commit()

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
    )

    return TokenResponse(
        user=user,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    token_hash = hash_refresh_token(refresh_token)

    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == token_hash)
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = db.get(User, session.user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    try:
        new_refresh_token = rotate_user_session(
            db=db,
            refresh_token=refresh_token,
            user_id=user.id,
        )
    except RefreshTokenReuseError:
        # Persist family-wide revocation before returning 401.
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected",
        )
    access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
    )

    db.commit()

    set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=new_refresh_token,
    )

    return TokenResponse(
        user=user,
    )

@router.post(
    "/logout",
)
def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(
        default=None,
        alias=settings.REFRESH_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
):
    validate_csrf(request)

    if refresh_token:
        revoke_user_session(
            db=db,
            refresh_token=refresh_token,
        )
        db.commit()

    clear_auth_cookies(response)

    return {
        "message": "Logged out successfully",
    }

@router.get("/csrf")
def get_csrf_token(response: Response):
    csrf_token = generate_csrf_token()

    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
        max_age=60 * 60,
    )

    return {"message": "CSRF token initialized"}
