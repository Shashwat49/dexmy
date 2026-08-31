import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BookingAssignmentAudit(Base):
    """
    Immutable audit log for teacher assignment actions.

    Every time an admin assigns (or reassigns) a teacher to a
    booking, one row is inserted here.

    This table is append-only.  Rows are never updated or
    deleted.

    IMPORTANT:
        The physical table is created by the Alembic migration
        in PR #4.  In this PR the model is defined here so the
        application code can reference it.  In tests,
        Base.metadata.create_all() creates the table in the
        in-memory SQLite database.

    Columns:
        booking_id   — the booking that was updated
        admin_id     — the admin who performed the action
        prev_teacher — teacher_id before the action (None on
                       first assignment)
        new_teacher  — teacher_id after the action
        action       — "assigned" | "reassigned"
        created_at   — wall-clock UTC timestamp of the action
    """

    __tablename__ = "booking_assignment_audits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "bookings.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # NULL on the first assignment.
    prev_teacher: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "teacher_profiles.user_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    new_teacher: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "teacher_profiles.user_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    # "assigned"   — first time a teacher is set
    # "reassigned" — teacher changed from one to another
    action: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
