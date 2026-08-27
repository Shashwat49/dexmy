from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.booking import ContactMessage
from app.models.payment import Payment, PaymentStatus
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.admin_dashboard import AdminDashboardMetrics, AdminDashboardResponse

router = APIRouter()


@router.get("/metrics", response_model=AdminDashboardResponse)
def get_dashboard_metrics(
    current_user: User = Depends(require_permission("dashboard.view")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    total_students = db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.student)
    ).scalar_one()
    total_teachers = db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.teacher)
    ).scalar_one()
    active_students = db.execute(
        select(func.count()).select_from(User).where(
            User.role == UserRole.student,
            User.is_active.is_(True),
        )
    ).scalar_one()
    verified_teachers = db.execute(
        select(func.count()).select_from(TeacherProfile).where(TeacherProfile.is_verified.is_(True))
    ).scalar_one()
    upcoming_bookings = db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.scheduled_at >= now,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        )
    ).scalar_one()
    pending_teacher_assignments = db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.status == BookingStatus.confirmed,
            Booking.teacher_id.is_(None),
        )
    ).scalar_one()
    unresolved_contact_messages = db.execute(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.is_resolved.is_(False))
    ).scalar_one()
    pending_payments = db.execute(
        select(func.count()).select_from(Payment).where(Payment.status == PaymentStatus.created)
    ).scalar_one()

    return AdminDashboardResponse(
        metrics=AdminDashboardMetrics(
            total_students=total_students,
            total_teachers=total_teachers,
            active_students=active_students,
            verified_teachers=verified_teachers,
            upcoming_bookings=upcoming_bookings,
            pending_teacher_assignments=pending_teacher_assignments,
            unresolved_contact_messages=unresolved_contact_messages,
            pending_payments=pending_payments,
        )
    )
