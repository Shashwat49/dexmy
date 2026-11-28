import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Table, Text, Column, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.teacher import Subject


package_plan_subjects = Table(
    "package_plan_subjects",
    Base.metadata,
    Column("package_plan_id", UUID(as_uuid=True), ForeignKey("package_plans.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", Integer, ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True),
)
Index("ix_package_plan_subjects_subject_id", package_plan_subjects.c.subject_id)


class PackagePlan(Base):
    __tablename__ = "package_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    class_count: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    is_custom: Mapped[bool] = mapped_column(nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    subjects: Mapped[list[Subject]] = relationship(secondary=package_plan_subjects, order_by=Subject.name)

    @property
    def subject_ids(self) -> list[int]:
        return [subject.id for subject in self.subjects]


class StudentPackage(Base):
    __tablename__ = "student_packages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    package_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("package_plans.id", ondelete="RESTRICT"), nullable=False)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT", name="fk_student_packages_payment_id_payments"),
        nullable=True,
        unique=True,
    )
    selected_subject_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("subjects.id", ondelete="RESTRICT", name="fk_student_packages_selected_subject_id_subjects"),
        nullable=True,
        index=True,
    )
    total_classes: Mapped[int] = mapped_column(Integer, nullable=False)
    classes_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_unlimited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PackageCreditLedger(Base):
    __tablename__ = "package_credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_package_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_packages.id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=True, index=True)
    external_class_record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("external_class_records.id", ondelete="RESTRICT"), nullable=True, unique=True)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
