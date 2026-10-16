import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BookingReminderDelivery(Base):
    """Tracks each reminder recipient so polling/restarts do not resend emails."""

    __tablename__ = "booking_reminder_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "booking_id",
            "recipient_type",
            name="uq_booking_reminder_booking_recipient",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_type: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
