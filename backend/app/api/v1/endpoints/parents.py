from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.student import ParentStudentLink
from app.models.user import User, UserRole
from app.schemas.profile import LinkedStudentRead, LinkStudentRequest

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