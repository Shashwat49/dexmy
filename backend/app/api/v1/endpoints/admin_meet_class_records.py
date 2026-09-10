from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.external_class_record import ExternalClassRecord
from app.models.user import User
from app.schemas.external_class_record import ExternalClassRecordRead

router = APIRouter()


def _record_read(record: ExternalClassRecord, db: Session) -> ExternalClassRecordRead:
    student = db.get(User, record.student_id)
    teacher = db.get(User, record.teacher_id)
    return ExternalClassRecordRead(
        id=record.id,
        student_id=record.student_id,
        student_package_id=record.student_package_id,
        teacher_id=record.teacher_id,
        student_name=student.full_name if student else "Unknown",
        student_email=student.email if student else "",
        teacher_name=teacher.full_name if teacher else "Unknown",
        subject=record.subject,
        topic=record.topic,
        started_at=record.started_at,
        ended_at=record.ended_at,
        duration_minutes=record.duration_minutes,
        status=record.status,
        teacher_notes=record.teacher_notes,
        homework=record.homework,
        google_meet_link=record.google_meet_link,
        created_at=record.created_at,
    )


@router.get("", response_model=list[ExternalClassRecordRead])
def list_meet_class_records(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    records = db.scalars(
        select(ExternalClassRecord)
        .order_by(ExternalClassRecord.started_at.desc())
    ).all()
    return [_record_read(record, db) for record in records]
