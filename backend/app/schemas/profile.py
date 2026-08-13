import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class TeacherProfileUpdate(BaseModel):
    bio: str | None = None
    qualifications: str | None = None
    years_experience: int | None = None
    hourly_rate: float | None = None
    subject_ids: list[int] | None = None  # replaces the full subject list when provided


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


class TeacherPublicRead(TeacherProfileRead):
    full_name: str
    avatar_url: str | None
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