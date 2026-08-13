import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    teacher_id: uuid.UUID
    subject_id: int
    scheduled_at: datetime
    student_id: uuid.UUID | None = None  # required when a parent is booking for their child
    provider: Literal["razorpay", "stripe"]


class RazorpayOrderInfo(BaseModel):
    order_id: str
    key_id: str
    amount: int  # paise
    currency: str = "INR"


class StripeOrderInfo(BaseModel):
    client_secret: str
    publishable_key: str
    amount: int  # cents
    currency: str = "usd"


class CheckoutResponse(BaseModel):
    booking_id: uuid.UUID
    payment_id: uuid.UUID
    provider: str
    razorpay: RazorpayOrderInfo | None = None
    stripe: StripeOrderInfo | None = None


class RazorpayVerifyRequest(BaseModel):
    payment_id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str