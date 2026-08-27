import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class PackageCheckoutRequest(BaseModel):
    package_plan_id: uuid.UUID
    provider: str = Field(pattern="^(razorpay|stripe)$")
    idempotency_key: uuid.UUID
    student_id: uuid.UUID | None = None


class PackageCheckoutResponse(BaseModel):
    payment_id: uuid.UUID
    package_plan_id: uuid.UUID
    provider: str
    amount: Decimal
    currency: str
    razorpay_order_id: str | None = None
    razorpay_key_id: str | None = None
    razorpay_amount: int | None = None
    stripe_client_secret: str | None = None
    stripe_publishable_key: str | None = None
    stripe_amount: int | None = None


class PackageRazorpayVerifyRequest(BaseModel):
    payment_id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
