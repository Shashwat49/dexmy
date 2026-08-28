import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.core.constants import CLASS_DURATION_MINUTES
from app.db.session import get_db
from app.models.booking import Booking
from app.models.user import User, UserRole
from app.services.scheduling_service import (
    get_active_bookings_for_interval,
    get_eligible_teacher_ids,
)

router = APIRouter()


class AdminTeacherCandidateRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    is_available: bool
    eligible: bool
    reason: str


@router.get("/{booking_id}/eligible-teachers", response_model=list[AdminTeacherCandidateRead])
def list_eligible_teachers(
    booking_id: uuid.UUID,
    current_user: User = Depends(require_permission("booking.read")),
    db: Session = Depends(get_db),
):
    """Read-only view of teachers eligible and available for an existing booking.

    This deliberately reuses the scheduling service's teacher eligibility and
    occupancy rules. It does not create, modify, assign, or cancel bookings.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    eligible_ids = set(get_eligible_teacher_ids(db, booking.subject_id))
    end = booking.scheduled_at + timedelta(
        minutes=booking.duration_minutes or CLASS_DURATION_MINUTES
    )
    occupied = {
        b.teacher_id
        for b in get_active_bookings_for_interval(
            db,
            booking.scheduled_at,
            end,
            exclude_booking_id=booking.id,
        )
        if b.teacher_id is not None
    }

    teachers = (
        db.query(User)
        .filter(User.id.in_(eligible_ids), User.role == UserRole.teacher)
        .order_by(User.full_name.asc())
        .all()
    )

    return [
        AdminTeacherCandidateRead(
            id=teacher.id,
            full_name=teacher.full_name,
            email=teacher.email,
            is_available=teacher.id not in occupied,
            eligible=True,
            reason="Available and eligible" if teacher.id not in occupied else "Eligible but occupied at this time",
        )
        for teacher in teachers
    ]
