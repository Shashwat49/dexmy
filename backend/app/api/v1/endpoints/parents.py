import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.student import ParentStudentLink
from app.models.user import User, UserRole
from app.models.booking import Booking
from app.models.teacher import Subject
from app.schemas.profile import LinkedStudentRead, LinkStudentRequest
from app.schemas.booking import BookingDetailRead

router = APIRouter()


@router.get("/me/students", response_model=list[LinkedStudentRead])
def list_my_students(
    current_user: User = Depends(require_role(UserRole.parent)),
    db: Session = Depends(get_db),
):
    links = db.query(ParentStudentLink).filter(ParentStudentLink.parent_id == current_user.id).all()
    return [
        LinkedStudentRead(id=(s := db.get(User, l.student_id)).id, full_name=s.full_name, email=s.email)
        for l in links
    ]


@router.post("/me/students", response_model=LinkedStudentRead, status_code=status.HTTP_201_CREATED)
def link_student(
    payload: LinkStudentRequest,
    current_user: User = Depends(require_role(UserRole.parent)),
    db: Session = Depends(get_db),
):
    student = db.query(User).filter(User.email == payload.student_email, User.role == UserRole.student).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No student account found with that email")

    if db.get(ParentStudentLink, (current_user.id, student.id)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already linked to this student")

    db.add(ParentStudentLink(parent_id=current_user.id, student_id=student.id))
    db.commit()
    return LinkedStudentRead(id=student.id, full_name=student.full_name, email=student.email)


@router.delete("/me/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_student(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.parent)),
    db: Session = Depends(get_db),
):
    link = db.get(ParentStudentLink, (current_user.id, student_id))
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not linked",
        )
    db.delete(link)
    db.commit()


@router.get("/me/students/{student_id}/bookings", response_model=list[BookingDetailRead])
def list_student_bookings(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.parent)),
    db: Session = Depends(get_db),
):
    # Verify parent is linked to this student
    link = db.get(ParentStudentLink, (current_user.id, student_id))
    if not link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this student's data.",
        )

    bookings = (
        db.query(Booking)
        .filter(Booking.student_id == student_id)
        .order_by(Booking.scheduled_at.asc())
        .all()
    )

    results = []
    for booking in bookings:
        student_user = db.get(User, booking.student_id)
        teacher_user = None
        if booking.teacher_id is not None:
            teacher_user = db.get(User, booking.teacher_id)
        subject = db.get(Subject, booking.subject_id)

        results.append(
            BookingDetailRead(
                id=booking.id,
                student_id=booking.student_id,
                student_name=student_user.full_name if student_user else "Unknown",
                teacher_id=booking.teacher_id,
                teacher_name=teacher_user.full_name if teacher_user else None,
                subject_id=booking.subject_id,
                subject_name=subject.name if subject else "Unknown",
                scheduled_at=booking.scheduled_at,
                duration_minutes=booking.duration_minutes,
                status=booking.status,
                price=float(booking.price) if booking.price is not None else None,
                created_at=booking.created_at,
                teacher_assignment_status=booking.teacher_assignment_status,
            )
        )

    return results