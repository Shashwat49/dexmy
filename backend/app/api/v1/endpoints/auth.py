from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_phone_verification_token,
    decode_phone_verification_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.phone_verification import PhoneVerificationCode
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.user import (
    MessageResponse,
    PhoneVerificationResponse,
    ResendPhoneOtpRequest,
    ResendPhoneOtpResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    VerifyPhoneRequest,
)
from app.services.otp_service import (
    OTP_MAX_ATTEMPTS,
    generate_otp,
    hash_otp,
    is_otp_expired,
    otp_expiry,
)
from app.services.sms_service import send_sms

import uuid

router = APIRouter()

@router.post(
    "/signup",
    response_model=PhoneVerificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    if payload.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created through public signup",
        )

    existing_email = (
        db.query(User)
        .filter(User.email == payload.email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    existing_phone = (
        db.query(User)
        .filter(User.phone == payload.phone)
        .first()
    )

    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        full_name=payload.full_name,
        phone=payload.phone,
        email_verified=True,
        phone_verified=False,
        is_active=True,
    )

    db.add(user)
    db.flush()

    if payload.role == UserRole.teacher:
        db.add(TeacherProfile(user_id=user.id))

    elif payload.role == UserRole.student:
        db.add(StudentProfile(user_id=user.id))

    otp = generate_otp()

    verification = PhoneVerificationCode(
        user_id=user.id,
        phone_number=payload.phone,
        code_hash=hash_otp(otp),
        expires_at=otp_expiry(),
        attempts=0,
    )

    db.add(verification)

    db.commit()
    db.refresh(user)

    verification_token = create_phone_verification_token(
        str(user.id)
    )

    try:
        await send_sms(
            payload.phone,
            f"Your Dexmy verification code is {otp}. "
            f"It expires in 10 minutes.",
        )
    except Exception:
        db.delete(verification)
        db.delete(user)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send verification code. Please try again.",
        )

    return PhoneVerificationResponse(
        message="Verification code sent to your mobile number.",
        verification_token=verification_token,
        phone=payload.phone,
    )

@router.post("/verify-phone", response_model=TokenResponse)
def verify_phone(
    payload: VerifyPhoneRequest,
    db: Session = Depends(get_db),
):
    try:
        token_payload = decode_phone_verification_token(
            payload.verification_token
        )

        user_id = uuid.UUID(token_payload["sub"])

    except (JWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification session",
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already verified",
        )

    verification = (
        db.query(PhoneVerificationCode)
        .filter(
            PhoneVerificationCode.user_id == user.id,
            PhoneVerificationCode.verified_at.is_(None),
        )
        .order_by(PhoneVerificationCode.created_at.desc())
        .first()
    )

    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found",
        )

    if is_otp_expired(verification.expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired",
        )

    if verification.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Please request a new code.",
        )

    verification.attempts += 1

    if hash_otp(payload.otp) != verification.code_hash:
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code",
        )

    verification.verified_at = datetime.now(timezone.utc)
    user.phone_verified = True

    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
    )

    return TokenResponse(
        access_token=token,
        user=user,
    )

@router.post(
    "/resend-phone-otp",
    response_model=ResendPhoneOtpResponse,
)
async def resend_phone_otp(
    payload: ResendPhoneOtpRequest,
    db: Session = Depends(get_db),
):
    try:
        token_payload = decode_phone_verification_token(
            payload.verification_token
        )

        user_id = uuid.UUID(token_payload["sub"])

    except (JWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification session",
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already verified",
        )

    latest = (
        db.query(PhoneVerificationCode)
        .filter(
            PhoneVerificationCode.user_id == user.id,
            PhoneVerificationCode.verified_at.is_(None),
        )
        .order_by(PhoneVerificationCode.created_at.desc())
        .first()
    )

    if latest is not None:
        now = datetime.now(timezone.utc)

        last_sent = latest.last_sent_at

        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)

        seconds_since_send = (
            now - last_sent
        ).total_seconds()

        if seconds_since_send < 60:
            remaining = int(60 - seconds_since_send)

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting another code.",
            )

    otp = generate_otp()

    verification = PhoneVerificationCode(
        user_id=user.id,
        phone_number=user.phone,
        code_hash=hash_otp(otp),
        expires_at=otp_expiry(),
        attempts=0,
    )

    db.add(verification)
    db.commit()

    try:
        await send_sms(
            user.phone,
            f"Your new Dexmy verification code is {otp}. "
            f"It expires in 10 minutes.",
        )
    except Exception:
        db.delete(verification)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send verification code. Please try again.",
        )

    return ResendPhoneOtpResponse(
        message="A new verification code has been sent."
    )

@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == payload.email)
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

    if not user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PHONE_NOT_VERIFIED",
        )

    token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
    )

    return TokenResponse(
        access_token=token,
        user=user,
    )