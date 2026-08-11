import uuid
from datetime import date as date_type, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.constants import SLOT_DURATION_MINUTES
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.teacher import TeacherAvailability, TeacherProfile
from app.models.user import User, UserRole
from app.schemas.teacher import AvailabilityCreate, AvailabilityRead, SlotRead

from app.models.teacher import TeacherSubject
from app.models.user import User as UserModel
from app.schemas.profile import TeacherProfileRead, TeacherProfileUpdate, TeacherPublicRead

from datetime import date as date_type, datetime, timedelta, timezone
from sqlalchemy import and_, or_

router = APIRouter()


@router.post("/me/availability", response_model=AvailabilityRead, status_code=status.HTTP_201_CREATED)
def add_availability(
    payload: AvailabilityCreate,
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    slot = TeacherAvailability(teacher_id=current_user.id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/me/availability", response_model=list[AvailabilityRead])
def list_my_availability(
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    return db.query(TeacherAvailability).filter(TeacherAvailability.teacher_id == current_user.id).all()


@router.delete("/me/availability/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_availability(
    availability_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    slot = db.get(TeacherAvailability, availability_id)
    if slot is None or slot.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability slot not found")
    db.delete(slot)
    db.commit()

@router.get("/me/profile", response_model=TeacherProfileRead)
def get_my_teacher_profile(
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    return db.get(TeacherProfile, current_user.id)


@router.patch("/me/profile", response_model=TeacherProfileRead)
def update_my_teacher_profile(
    payload: TeacherProfileUpdate,
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    profile = db.get(TeacherProfile, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True, exclude={"subject_ids"}).items():
        setattr(profile, field, value)

    if payload.subject_ids is not None:
        db.query(TeacherSubject).filter(TeacherSubject.teacher_id == current_user.id).delete()
        for subject_id in payload.subject_ids:
            db.add(TeacherSubject(teacher_id=current_user.id, subject_id=subject_id))

    db.commit()
    db.refresh(profile)
    return profile

def _to_public_read(profile: TeacherProfile, user: UserModel, db: Session) -> TeacherPublicRead:
    subject_ids = [ts.subject_id for ts in db.query(TeacherSubject).filter(TeacherSubject.teacher_id == profile.user_id).all()]
    return TeacherPublicRead(
        user_id=profile.user_id, bio=profile.bio, qualifications=profile.qualifications,
        years_experience=profile.years_experience, hourly_rate=profile.hourly_rate,
        is_verified=profile.is_verified, rating_avg=profile.rating_avg, rating_count=profile.rating_count,
        full_name=user.full_name, avatar_url=user.avatar_url, subject_ids=subject_ids,
    )


@router.get("", response_model=list[TeacherPublicRead])
def browse_teachers(subject_id: int | None = Query(None), db: Session = Depends(get_db)):
    query = db.query(TeacherProfile).filter(TeacherProfile.is_verified == True)
    if subject_id is not None:
        query = query.join(TeacherSubject, TeacherSubject.teacher_id == TeacherProfile.user_id).filter(TeacherSubject.subject_id == subject_id)
    return [_to_public_read(p, db.get(UserModel, p.user_id), db) for p in query.all()]


@router.get("/{teacher_id}/availability", response_model=list[AvailabilityRead])
def get_teacher_availability(teacher_id: uuid.UUID, db: Session = Depends(get_db)):
    teacher = db.get(TeacherProfile, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return db.query(TeacherAvailability).filter(TeacherAvailability.teacher_id == teacher_id).all()


@router.get("/{teacher_id}/slots", response_model=list[SlotRead])
def get_available_slots(
    teacher_id: uuid.UUID,
    date: date_type = Query(...),
    duration_minutes: int = Query(60, ge=15, le=180),
    db: Session = Depends(get_db),
):
    teacher = db.get(TeacherProfile, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    day_of_week = (date.weekday() + 1) % 7  # Python Mon=0..Sun=6 -> Sun=0..Sat=6 to match schema

    windows = (
        db.query(TeacherAvailability)
        .filter(TeacherAvailability.teacher_id == teacher_id, TeacherAvailability.day_of_week == day_of_week)
        .all()
    )
    if not windows:
        return []

    day_start = datetime.combine(date, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    pending_cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)

    existing_bookings = (
        db.query(Booking)
        .filter(
            Booking.teacher_id == teacher_id,
            or_(
                Booking.status == BookingStatus.confirmed,
                and_(Booking.status == BookingStatus.pending, Booking.created_at >= pending_cutoff),
            ),
            Booking.scheduled_at >= day_start,
            Booking.scheduled_at < day_end,
        )
        .all()
    )
    booked_ranges = [(b.scheduled_at, b.scheduled_at + timedelta(minutes=b.duration_minutes)) for b in existing_bookings]

    slots: list[SlotRead] = []
    step = timedelta(minutes=SLOT_DURATION_MINUTES)  # slots step by the full hour, buffer included
    for window in windows:
        window_start = datetime.combine(date, window.start_time)
        window_end = datetime.combine(date, window.end_time)
        cursor = window_start
        while cursor + step <= window_end:
            slot_end = cursor + step
            overlaps = any(cursor < b_end and slot_end > b_start for b_start, b_end in booked_ranges)
            if not overlaps and cursor > datetime.utcnow():
                slots.append(SlotRead(start_time=cursor, end_time=slot_end))
            cursor += step

    return slots

@router.get("/{teacher_id}", response_model=TeacherPublicRead)
def get_teacher_public_profile(teacher_id: uuid.UUID, db: Session = Depends(get_db)):
    profile = db.get(TeacherProfile, teacher_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return _to_public_read(profile, db.get(UserModel, teacher_id), db)