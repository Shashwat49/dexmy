import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_permission
from app.db.session import get_db
from app.models.booking import Booking
from app.models.class_review import ClassReview
from app.models.classroom import ClassSession, SessionStatus
from app.models.user import User
from app.schemas.class_review import ClassReviewCreate, ClassReviewRead

router = APIRouter()

STUDENT_POINTS = [
    "Teacher explained concepts clearly",
    "Teacher was knowledgeable and well-prepared",
    "Teacher was patient and answered questions",
    "Teacher kept me engaged throughout the class",
    "Teacher was punctual",
]
TEACHER_POINTS = [
    "Student was attentive and focused",
    "Student participated actively",
    "Student was prepared for the class",
    "Student was respectful and cooperative",
    "Student completed or attempted the assigned work",
]


def _review_points(role: str) -> list[str]:
    return STUDENT_POINTS if role == "student" else TEACHER_POINTS


@router.get("/sessions/{session_id}/options")
def get_review_options(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(ClassSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, session.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=403, detail="Not part of this class")
    if session.status != SessionStatus.ended:
        raise HTTPException(status_code=409, detail="Review is available after the class ends")
    role = "teacher" if current_user.id == booking.teacher_id else "student"
    existing = db.scalar(select(ClassReview).where(ClassReview.session_id == session_id, ClassReview.reviewer_id == current_user.id))
    return {"role": role, "points": _review_points(role), "submitted": existing is not None}


@router.post("/sessions/{session_id}", response_model=ClassReviewRead, status_code=201)
def submit_review(session_id: uuid.UUID, payload: ClassReviewCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(ClassSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, session.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=403, detail="Not part of this class")
    if session.status != SessionStatus.ended:
        raise HTTPException(status_code=409, detail="Review is available after the class ends")
    role = "teacher" if current_user.id == booking.teacher_id else "student"
    allowed = set(_review_points(role))
    checked = list(dict.fromkeys(payload.checked_points or []))
    invalid = [point for point in checked if point not in allowed]
    if invalid:
        raise HTTPException(status_code=422, detail="Invalid review option")
    existing = db.scalar(select(ClassReview).where(ClassReview.session_id == session_id, ClassReview.reviewer_id == current_user.id))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Review already submitted")
    review = ClassReview(
        session_id=session_id,
        reviewer_id=current_user.id,
        reviewee_id=booking.student_id if role == "teacher" else booking.teacher_id,
        reviewer_role=role,
        checked_points=checked,
        additional_opinion=payload.additional_opinion.strip() if payload.additional_opinion else None,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.get("/admin", response_model=list[ClassReviewRead])
def list_reviews(current_user: User = Depends(require_permission("review.read")), db: Session = Depends(get_db)):
    rows = db.execute(
        select(ClassReview)
        .order_by(desc(ClassReview.created_at))
    ).scalars().all()
    return rows
