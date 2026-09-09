import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    grade_level: Mapped[str | None] = mapped_column(String(50))
    school_name: Mapped[str | None] = mapped_column(String(255))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    board: Mapped[str | None] = mapped_column(String(100))
    academic_year: Mapped[str | None] = mapped_column(String(30))
    subjects: Mapped[str | None] = mapped_column(String(500))
    student_id_number: Mapped[str | None] = mapped_column(String(100))
    parent_name: Mapped[str | None] = mapped_column(String(255))
    parent_email: Mapped[str | None] = mapped_column(String(255))
    parent_phone: Mapped[str | None] = mapped_column(String(20))
    parent_relationship: Mapped[str | None] = mapped_column(String(50))
    parent_occupation: Mapped[str | None] = mapped_column(String(150))


class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"

    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
