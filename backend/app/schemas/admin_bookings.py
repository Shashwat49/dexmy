import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.booking import BookingStatus


class AdminBookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    teacher_assignment_status: str
    created_at: datetime


class AdminBookingListResponse(BaseModel):
    items: list[AdminBookingRead]
    total: int
    page: int
    page_size: int
