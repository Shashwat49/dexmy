import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExternalClassRecordCreate(BaseModel):
    student_id: uuid.UUID
    student_package_id: uuid.UUID
    subject: str = Field(min_length=1, max_length=150)
    topic: str = Field(min_length=1, max_length=255)
    started_at: datetime
    ended_at: datetime
    status: str = Field(default="completed", pattern="^(completed|cancelled|no_show)$")
    teacher_notes: str | None = Field(default=None, max_length=10000)
    homework: str | None = Field(default=None, max_length=10000)
    google_meet_link: str | None = Field(default=None, max_length=2000)

    @field_validator("subject", "topic")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value


class ExternalClassRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    student_package_id: uuid.UUID
    teacher_id: uuid.UUID
    student_name: str
    student_email: str
    teacher_name: str
    subject: str
    topic: str
    started_at: datetime
    ended_at: datetime
    duration_minutes: int
    status: str
    teacher_notes: str | None
    homework: str | None
    google_meet_link: str | None
    created_at: datetime


class ExternalStudentPackageRead(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    total_classes: int
    completed_classes: int
    remaining_classes: int
    status: str
    package_name: str
    currency: str
    price: float
