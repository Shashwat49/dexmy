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
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
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
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    grade_level: str | None = Field(default=None, max_length=50)
    school_name: str | None = Field(default=None, max_length=255)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    board: str | None = Field(default=None, max_length=100)
    academic_year: str | None = Field(default=None, max_length=30)
    subjects: str | None = Field(default=None, max_length=500)
    student_id_number: str | None = Field(default=None, max_length=100)
    parent_name: str | None = Field(default=None, max_length=255)
    parent_email: str | None = Field(default=None, max_length=255)
    parent_phone: str | None = Field(default=None, max_length=20)
    parent_relationship: str | None = Field(default=None, max_length=50)
    parent_occupation: str | None = Field(default=None, max_length=150)


class StudentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: uuid.UUID
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    grade_level: str | None
    school_name: str | None
    date_of_birth: date | None
    gender: str | None
    address: str | None
    city: str | None
    country: str | None
    board: str | None
    academic_year: str | None
    subjects: str | None
    student_id_number: str | None
    parent_name: str | None
    parent_email: str | None
    parent_phone: str | None
    parent_relationship: str | None
    parent_occupation: str | None


class LinkStudentRequest(BaseModel):
    student_email: str


class LinkedStudentRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
