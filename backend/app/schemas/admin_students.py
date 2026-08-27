import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdminStudentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: str | None
    avatar_url: str | None
    is_active: bool
    email_verified: bool
    created_at: datetime
    grade_level: str | None = None
    school_name: str | None = None
    date_of_birth: date | None = None
    total_bookings: int = 0
    completed_classes: int = 0
    upcoming_classes: int = 0


class AdminStudentListResponse(BaseModel):
    items: list[AdminStudentRead]
    total: int
    page: int
    page_size: int


class AdminStudentStatusUpdate(BaseModel):
    is_active: bool
    reason: str | None = Field(default=None, max_length=500)


class AdminStudentDetailRead(AdminStudentRead):
    cancelled_classes: int = 0
    no_show_classes: int = 0
    pending_classes: int = 0
    confirmed_classes: int = 0
