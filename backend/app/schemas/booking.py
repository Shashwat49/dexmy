import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
)

from app.models.booking import (
    BookingStatus,
    DemoStatus,
)


# ============================================================
# STUDENT BOOKING REQUEST
# ============================================================

class BookingCreate(BaseModel):
    """
    Student only chooses the subject.

    Teacher and scheduled_at are deliberately NOT accepted
    from the student.
    """

    subject_id: int


# ============================================================
# BOOKING READ
# ============================================================

class BookingRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: uuid.UUID

    student_id: uuid.UUID
    teacher_id: uuid.UUID
    subject_id: int

    scheduled_at: datetime

    duration_minutes: int

    status: BookingStatus

    price: float | None

    created_at: datetime


# ============================================================
# DETAILED BOOKING
# ============================================================

class BookingDetailRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: uuid.UUID

    student_id: uuid.UUID
    student_name: str

    teacher_id: uuid.UUID
    teacher_name: str

    subject_id: int
    subject_name: str

    scheduled_at: datetime

    duration_minutes: int

    status: BookingStatus

    price: float | None

    created_at: datetime


# ============================================================
# DEMO
# ============================================================

class DemoRequestCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    subject_id: int | None = None
    preferred_time: datetime | None = None


class DemoRequestRead(DemoRequestCreate):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: uuid.UUID
    status: DemoStatus
    created_at: datetime