from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AdminStudentPackageRead(BaseModel):
    id: UUID
    student_id: UUID
    package_plan_id: UUID
    payment_id: UUID | None
    total_classes: int
    classes_used: int
    classes_remaining: int
    status: str
    purchased_at: datetime
    expires_at: datetime | None
    package_name: str
    price: Decimal
    currency: str


class AdminCreditAdjustment(BaseModel):
    delta: int = Field(ne=0, ge=-1000, le=1000)
    reason: str = Field(min_length=3, max_length=50)


class AdminCreditAdjustmentResponse(BaseModel):
    student_package_id: UUID
    delta: int
    classes_used: int
    classes_remaining: int
    reason: str
    ledger_id: UUID
