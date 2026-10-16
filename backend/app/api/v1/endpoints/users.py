import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cookies import clear_auth_cookies
from app.core.csrf import validate_csrf
from app.core.dependencies import get_current_user
from app.core.security import verify_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.services.account_security_email import find_valid_action_token, issue_action_token, send_email_change_email
from app.schemas.profile import UserUpdate
from app.schemas.user import UserRead

router = APIRouter()
logger = logging.getLogger(__name__)
ACCOUNT_ROLES = {UserRole.student, UserRole.teacher, UserRole.parent}


class EmailChangePayload(BaseModel):
    email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)


class PhoneChangePayload(BaseModel):
    phone: str = Field(min_length=7, max_length=20)
    current_password: str = Field(min_length=1, max_length=128)


class ConfirmEmailChangePayload(BaseModel):
    token: str = Field(min_length=20, max_length=256)


@router.get("/me", response_model=UserRead)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserRead)
def update_my_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/email/change")
def request_email_change(
    request: Request,
    payload: EmailChangePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ACCOUNT_ROLES:
        raise HTTPException(status_code=403, detail="This feature is available for student, teacher, and parent accounts only.")
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    new_email = str(payload.email).lower().strip()
    if new_email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="This is already your current email address.")
    if db.query(User).filter(func.lower(User.email) == new_email).first():
        raise HTTPException(status_code=409, detail="That email address is already registered.")
    if not settings.SMTP_PASSWORD:
        raise HTTPException(status_code=503, detail="Email verification is temporarily unavailable. Please try again later.")

    try:
        token = issue_action_token(
            db,
            user_id=current_user.id,
            purpose="email_change",
            target_email=new_email,
            lifetime_minutes=60,
        )
        db.commit()
        send_email_change_email(new_email, current_user.full_name, token)
    except Exception:
        db.rollback()
        logger.exception("Unable to send an email-change confirmation")
        raise HTTPException(status_code=503, detail="We couldn't send the confirmation email. Please try again later.")
    return {"message": "Confirmation sent. Your current email will remain unchanged until you confirm the link sent to your new address."}


@router.post("/email/confirm")
def confirm_email_change(
    request: Request,
    response: Response,
    payload: ConfirmEmailChangePayload,
    db: Session = Depends(get_db),
):
    validate_csrf(request)
    action = find_valid_action_token(db, payload.token, "email_change")
    if action is None or not action.target_email:
        raise HTTPException(status_code=400, detail="This email confirmation link is invalid or has expired.")
    user = db.get(User, action.user_id)
    if user is None or user.role not in ACCOUNT_ROLES or not user.is_active:
        raise HTTPException(status_code=400, detail="This email confirmation link is invalid or has expired.")
    new_email = action.target_email.lower().strip()
    if db.query(User).filter(func.lower(User.email) == new_email, User.id != user.id).first():
        raise HTTPException(status_code=409, detail="That email address is already registered. Please request a new change with another address.")
    now = datetime.now(timezone.utc)
    action.used_at = now
    user.email = new_email
    user.email_verified = True
    # Sensitive identity change: revoke refresh sessions on all devices.
    db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)
    db.commit()
    clear_auth_cookies(response)
    return {"message": "Email address updated successfully. Please log in again.", "email": new_email}


@router.post("/me/phone/change")
def change_phone_number(
    payload: PhoneChangePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ACCOUNT_ROLES:
        raise HTTPException(status_code=403, detail="This feature is available for student, teacher, and parent accounts only.")
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    phone = payload.phone.strip()
    if len(phone) < 7 or len(phone) > 20:
        raise HTTPException(status_code=422, detail="Enter a valid phone number including its country code.")
    if phone == (current_user.phone or ""):
        raise HTTPException(status_code=400, detail="This is already your current phone number.")
    duplicate = db.query(User).filter(User.phone == phone, User.id != current_user.id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That phone number is already associated with another account.")
    current_user.phone = phone
    db.commit()
    db.refresh(current_user)
    return {"message": "Phone number updated successfully.", "phone": current_user.phone}
