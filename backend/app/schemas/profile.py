import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class TeacherProfileUpdate(BaseModel):
    bio: str | None = None
    qualifications: str | None = None
    years_experience: int | None = Field(default=None, ge=0, le=60)
    hourly_rate: float | None = Field(default=None, ge=0)
    subject_ids: list[int] | None = None

    @field_validator("bio", "qualifications")
    @classmethod
    def reject_blank_text(cls, value):
        if value is not None and not value.strip():
            raise ValueError("This field is required")
        return value.strip() if value is not None else value


class TeacherProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: uuid.UUID
    bio: str | None
    qualifications: str | None
    years_experience: int | None
    hourly_rate: float | None
    is_verified: bool
    rating_avg: float
    rating_count: int
    subject_ids: list[int] = []


class TeacherPublicRead(BaseModel):
    user_id: uuid.UUID
    full_name: str
    avatar_url: str | None
    bio: str | None
    qualifications: str | None
    years_experience: int | None
    hourly_rate: float | None
    is_verified: bool
    rating_avg: float
    rating_count: int
    subject_ids: list[int] = []


class StudentProfileUpdate(BaseModel):
    grade_level: str | None = None
    school_name: str | None = None
    date_of_birth: date | None = None


class StudentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: uuid.UUID
    grade_level: str | None
    school_name: str | None
    date_of_birth: date | None


class LinkStudentRequest(BaseModel):
    student_email: str


class LinkedStudentRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
