import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.student_subject_teacher import StudentSubjectTeacher
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.user import User, UserRole
from app.schemas.booking import (
    PendingTeacherAssignmentRead,
    TeacherAssignmentRead,
    TeacherAssignmentRequest,
)
from app.schemas.user import UserRead
from app.services.booking_service import assign_teacher_atomic
from app.services.scheduling_service import can_assign_teacher

router = APIRouter()


# ============================================================
# USER MANAGEMENT
# ============================================================

@router.get("/users", response_model=list[UserRead])
def list_all_users(
    role: UserRole | None = None,
    current_user: User = Depends(require_permission("student.read")),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_permission("student.suspend")),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_permission("student.update")),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


# ============================================================
# TEACHER MANAGEMENT
# ============================================================

@router.patch("/teachers/{teacher_id}/verify", status_code=status.HTTP_204_NO_CONTENT)
def verify_teacher(
    teacher_id: uuid.UUID,
    current_user: User = Depends(require_permission("teacher.verify")),
    db: Session = Depends(get_db),
):
    profile = db.get(TeacherProfile, teacher_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher profile not found")
    profile.is_verified = True
    db.commit()


# ============================================================
# PENDING TEACHER ASSIGNMENTS
# ============================================================

@router.get(
    "/bookings/pending-teacher-assignment",
    response_model=list[PendingTeacherAssignmentRead],
)
def list_pending_teacher_assignments(
    current_user: User = Depends(require_permission("booking.read")),
    db: Session = Depends(get_db),
):
    rows = (
        db.execute(
            select(
                Booking,
                User.full_name.label("student_name"),
                Subject.name.label("subject_name"),
            )
            .join(User, User.id == Booking.student_id)
            .join(Subject, Subject.id == Booking.subject_id)
            .where(
                Booking.status == BookingStatus.confirmed,
                Booking.teacher_id.is_(None),
            )
            .order_by(Booking.scheduled_at.asc())
        )
        .all()
    )

    return [
        PendingTeacherAssignmentRead(
            booking_id=booking.id,
            student_id=booking.student_id,
            student_name=student_name,
            subject_id=booking.subject_id,
            subject_name=subject_name,
            scheduled_at=booking.scheduled_at,
            duration_minutes=booking.duration_minutes,
            teacher_assignment_status=booking.teacher_assignment_status,
        )
        for booking, student_name, subject_name in rows
    ]


# ============================================================
# ELIGIBLE TEACHERS
# ============================================================

@router.get("/bookings/{booking_id}/eligible-teachers", response_model=list[UserRead])
def list_eligible_teachers(
    booking_id: uuid.UUID,
    current_user: User = Depends(require_permission("booking.assign_teacher")),
    db: Session = Depends(get_db),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only confirmed bookings can receive a teacher.")
    if booking.teacher_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A teacher is already assigned to this booking.")

    teachers = (
        db.query(User)
        .join(TeacherProfile, TeacherProfile.user_id == User.id)
        .join(TeacherSubject, TeacherSubject.teacher_id == TeacherProfile.user_id)
        .filter(
            User.role == UserRole.teacher,
            User.is_active.is_(True),
            TeacherProfile.is_verified.is_(True),
            TeacherSubject.subject_id == booking.subject_id,
        )
        .distinct()
        .all()
    )

    eligible = []
    for teacher in teachers:
        can_assign, _ = can_assign_teacher(db=db, booking=booking, teacher_id=teacher.id)
        if can_assign:
            eligible.append(teacher)
    return eligible


# ============================================================
# ASSIGN TEACHER
# ============================================================

@router.post("/bookings/{booking_id}/assign-teacher", response_model=TeacherAssignmentRead)
def assign_teacher(
    booking_id: uuid.UUID,
    payload: TeacherAssignmentRequest,
    current_user: User = Depends(require_permission("booking.assign_teacher")),
    db: Session = Depends(get_db),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    try:
        booking = assign_teacher_atomic(
            db=db,
            booking=booking,
            teacher_id=payload.teacher_id,
            admin_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    db.commit()
    db.refresh(booking)

    student = db.get(User, booking.student_id)
    teacher = db.get(User, booking.teacher_id)
    subject = db.get(Subject, booking.subject_id)

    return TeacherAssignmentRead(
        booking_id=booking.id,
        student_id=booking.student_id,
        student_name=student.full_name if student else "Unknown",
        subject_id=booking.subject_id,
        subject_name=subject.name if subject else "Unknown",
        teacher_id=booking.teacher_id,
        teacher_name=teacher.full_name if teacher else "Unknown",
        scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes,
        teacher_assignment_status=booking.teacher_assignment_status,
    )
