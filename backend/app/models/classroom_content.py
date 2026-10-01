import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Note: chat is ephemeral by design (relayed live over WebSocket, never
# persisted) — no ChatMessage model here on purpose.

class WhiteboardSnapshot(Base):
    __tablename__ = "whiteboard_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("class_sessions.id", ondelete="CASCADE"), index=True)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String)
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    page_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classroom_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClassroomPage(Base):
    __tablename__ = "classroom_pages"
    __table_args__ = (UniqueConstraint("session_id", "position", name="uq_classroom_page_position"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("class_sessions.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    page_type: Mapped[str] = mapped_column(String(20), nullable=False, default="whiteboard")
    image_url: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClassNotes(Base):
    __tablename__ = "class_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("class_sessions.id", ondelete="CASCADE"), unique=True)
    pdf_url: Mapped[str] = mapped_column(String, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
