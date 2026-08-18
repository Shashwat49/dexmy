import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
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
    Student chooses:
        - subject
        - requested time slot

    Student cannot choose:
        - teacher
        - price
        - booking status
        - duration
    """

    subject_id: int
    scheduled_at: datetime


# ============================================================
# AVAILABLE SLOT
# ============================================================

class AvailableSlot(BaseModel):
    """
    One booking slot returned to the student.
    """

    start: datetime
    end: datetime

    available: bool

    remaining_capacity: int


# ============================================================
# AVAILABLE SLOTS RESPONSE
# ============================================================

class AvailableSlotsRead(BaseModel):
    """
    Available booking slots for tomorrow.
    """

    date: str
    timezone: str

    slots: list[AvailableSlot]


# ============================================================
# BOOKING READ
# ============================================================

class BookingRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: uuid.UUID

    student_id: uuid.UUID

    teacher_id: uuid.UUID | None

    subject_id: int

    scheduled_at: datetime

    duration_minutes: int

    status: BookingStatus

    price: float | None

    created_at: datetime

    teacher_assignment_status: str


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

    teacher_id: uuid.UUID | None
    teacher_name: str | None

    subject_id: int
    subject_name: str

    scheduled_at: datetime

    duration_minutes: int

    status: BookingStatus

    price: float | None

    created_at: datetime

    teacher_assignment_status: str


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

# ============================================================
# ADMIN TEACHER ASSIGNMENT
# ============================================================

class TeacherAssignmentRequest(BaseModel):
    """
    Admin selects the teacher to assign to an already
    confirmed booking.
    """

    teacher_id: uuid.UUID


class PendingTeacherAssignmentRead(BaseModel):
    """
    Booking waiting for teacher assignment.
    """

    booking_id: uuid.UUID

    student_id: uuid.UUID
    student_name: str

    subject_id: int
    subject_name: str

    scheduled_at: datetime
    duration_minutes: int

    teacher_assignment_status: str


class TeacherAssignmentRead(BaseModel):
    """
    Result after a teacher has been assigned.
    """

    booking_id: uuid.UUID

    student_id: uuid.UUID
    student_name: str

    subject_id: int
    subject_name: str

    teacher_id: uuid.UUID
    teacher_name: str

    scheduled_at: datetime
    duration_minutes: int

    teacher_assignment_status: str