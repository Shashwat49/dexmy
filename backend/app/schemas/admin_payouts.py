from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PayoutAccountRead(BaseModel):
    id: UUID
    teacher_id: UUID
    account_holder_name: str
    bank_name: str | None
    account_last4: str | None
    upi_id: str | None
    payout_method: str
    verification_status: str
    verified_by: UUID | None
    verified_at: datetime | None
    rejection_reason: str | None

    model_config = {"from_attributes": True}


class PayoutAccountVerification(BaseModel):
    approved: bool
    reason: str | None = Field(default=None, max_length=500)


class PayoutRead(BaseModel):
    id: UUID
    teacher_id: UUID
    period_start: datetime
    period_end: datetime
    gross_amount: Decimal
    adjustments: Decimal
    net_amount: Decimal
    currency: str
    status: str
    approved_by: UUID | None
    approved_at: datetime | None
    paid_at: datetime | None
    external_reference: str | None
    notes: str | None

    model_config = {"from_attributes": True}
