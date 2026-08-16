import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# GENERIC USER PROFILE
# ============================================================

class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


# ============================================================
# TEACHER
# ============================================================

class TeacherProfileUpdate(BaseModel):
    bio: str | None = None
    qualifications: str | None = None

    years_experience: int | None = Field(
        default=None,
        ge=0,
        le=60,
    )

    hourly_rate: float | None = Field(
        default=None,
        ge=0,
    )

    subject_ids: list[int] | None = None


class TeacherProfileRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

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


# ============================================================
# STUDENT
# ============================================================

class StudentProfileUpdate(BaseModel):
    grade_level: str | None = None
    school_name: str | None = None
    date_of_birth: date | None = None


class StudentProfileRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    user_id: uuid.UUID

    grade_level: str | None
    school_name: str | None
    date_of_birth: date | None


# ============================================================
# PARENT
# ============================================================

class LinkStudentRequest(BaseModel):
    student_email: str


class LinkedStudentRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str