from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.user import TokenResponse, UserCreate, UserLogin


router = APIRouter()


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
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

    token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
    )

    return TokenResponse(
        access_token=token,
        user=user,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: UserLogin,
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

    token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
    )

    return TokenResponse(
        access_token=token,
        user=user,
    )