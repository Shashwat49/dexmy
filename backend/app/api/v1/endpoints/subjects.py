from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.teacher import Subject
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectRead

router = APIRouter()


# ============================================================
# PUBLIC
# ============================================================

@router.get("", response_model=list[SubjectRead])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).order_by(Subject.name.asc()).all()


@router.get("/{subject_id}", response_model=SubjectRead)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return subject


# ============================================================
# ADMIN / ACADEMIC MANAGEMENT
# ============================================================

@router.post(
    "",
    response_model=SubjectRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subject(
    payload: SubjectCreate,
    current_user: User = Depends(require_permission("subject.create")),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()

    existing = db.query(Subject).filter(Subject.name == name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Subject already exists",
        )

    subject = Subject(name=name, description=payload.description)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject
