from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.external_class_record import ExternalClassRecord
from app.models.user import User
from app.schemas.external_class_record import ExternalClassRecordRead

router = APIRouter()


def _record_read(record: ExternalClassRecord, student: User | None, teacher: User | None, admin: User | None) -> ExternalClassRecordRead:
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
        created_by_admin_id=record.created_by_admin_id,
        created_by_admin_name=admin.full_name if admin else None,
        created_at=record.created_at,
    )


@router.get("", response_model=list[ExternalClassRecordRead])
def list_meet_class_records(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Join user details in one query instead of issuing up to three additional
    # database queries per record. The old N+1 pattern made this endpoint take
    # 20+ seconds for the admin portal to load.
    student_user = aliased(User)
    teacher_user = aliased(User)
    admin_user = aliased(User)

    rows = db.execute(
        select(ExternalClassRecord, student_user, teacher_user, admin_user)
        .outerjoin(student_user, student_user.id == ExternalClassRecord.student_id)
        .outerjoin(teacher_user, teacher_user.id == ExternalClassRecord.teacher_id)
        .outerjoin(admin_user, admin_user.id == ExternalClassRecord.created_by_admin_id)
        .order_by(ExternalClassRecord.started_at.desc())
    ).all()

    return [
        _record_read(record, student, teacher, admin)
        for record, student, teacher, admin in rows
    ]
