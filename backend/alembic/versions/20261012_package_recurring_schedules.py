"""Add admin-approved recurring package schedules.

Revision ID: 20261012_package_recurring_schedules
Revises: 20261008_unlimited_booking_ledger_reason, 20261002_admin_no_show_class_records
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261012_package_recurring_schedules"
down_revision = ("20261008_unlimited_booking_ledger_reason", "20261002_admin_no_show_class_records")
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "package_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("student_package_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("student_packages.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teacher_profiles.user_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("weekdays", sa.JSON(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="55"),
        sa.Column("class_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="approved"),
        sa.Column("idempotency_key", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("idempotency_key", name="uq_package_schedules_idempotency_key"),
    )
    op.create_index("ix_package_schedules_student_id", "package_schedules", ["student_id"])
    op.create_index("ix_package_schedules_student_package_id", "package_schedules", ["student_package_id"])
    op.create_index("ix_package_schedules_teacher_id", "package_schedules", ["teacher_id"])
    op.create_index("ix_package_schedules_status", "package_schedules", ["status"])
    op.add_column("bookings", sa.Column("schedule_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_bookings_schedule_id_package_schedules",
        "bookings",
        "package_schedules",
        ["schedule_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_bookings_schedule_id", "bookings", ["schedule_id"])


def downgrade():
    op.drop_index("ix_bookings_schedule_id", table_name="bookings")
    op.drop_constraint("fk_bookings_schedule_id_package_schedules", "bookings", type_="foreignkey")
    op.drop_column("bookings", "schedule_id")
    op.drop_index("ix_package_schedules_status", table_name="package_schedules")
    op.drop_index("ix_package_schedules_teacher_id", table_name="package_schedules")
    op.drop_index("ix_package_schedules_student_package_id", table_name="package_schedules")
    op.drop_index("ix_package_schedules_student_id", table_name="package_schedules")
    op.drop_table("package_schedules")
