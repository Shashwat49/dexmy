import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: str | None = None


class UserCreate(UserBase):
    password: str
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    avatar_url: str | None = None
    is_active: bool
    email_verified: bool
    phone_verified: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead

class MessageResponse(BaseModel):
    message: str

class PhoneVerificationResponse(BaseModel):
    message: str
    verification_token: str
    phone: str

class VerifyPhoneRequest(BaseModel):
    verification_token: str
    otp: str

class ResendPhoneOtpRequest(BaseModel):
    verification_token: str

class ResendPhoneOtpResponse(BaseModel):
    message: str