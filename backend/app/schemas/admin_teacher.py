import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AdminTeacherListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    is_active: bool
    is_verified: bool
    rating_avg: Decimal | None
    rating_count: int
    years_experience: int | None
    hourly_rate: Decimal | None
    subject_count: int
    completed_classes: int
    upcoming_classes: int


class AdminTeacherDetail(AdminTeacherListItem):
    bio: str | None
    qualifications: str | None
    subjects: list[str]
    created_at: datetime


class AdminTeacherStatusUpdate(BaseModel):
    is_active: bool


class AdminTeacherSubjectUpdate(BaseModel):
    subject_id: int = Field(gt=0)


class AdminTeacherSubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject_id: int
    subject_name: str
