import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession, SessionStatus
from app.models.payment import Payment, PaymentProvider, PaymentStatus
from app.models.student import ParentStudentLink
from app.models.teacher import TeacherProfile, TeacherSubject
from app.models.user import User, UserRole
from app.schemas.payment import CheckoutRequest, CheckoutResponse, RazorpayOrderInfo, RazorpayVerifyRequest, StripeOrderInfo
from app.services import razorpay_service, stripe_service
from app.core.constants import SLOT_DURATION_MINUTES, CLASS_DURATION_MINUTES

from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, or_

router = APIRouter()

def _resolve_student_id(current_user: User, requested_student_id: uuid.UUID | None, db: Session) -> uuid.UUID:
    if current_user.role == UserRole.student:
        return current_user.id
    if current_user.role == UserRole.parent:
        if requested_student_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_id is required when booking as a parent")
        if db.get(ParentStudentLink, (current_user.id, requested_student_id)) is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not linked to this student")
        return requested_student_id
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students or parents can book classes")


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(payload: CheckoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student_id = _resolve_student_id(current_user, payload.student_id, db)

    teacher = db.get(TeacherProfile, payload.teacher_id)
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    if teacher.hourly_rate is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This teacher hasn't set a rate yet")

    teaches_subject = db.query(TeacherSubject).filter(
        TeacherSubject.teacher_id == payload.teacher_id, TeacherSubject.subject_id == payload.subject_id
    ).first()
    if teaches_subject is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This teacher doesn't teach that subject")

    slot_end = payload.scheduled_at + timedelta(minutes=SLOT_DURATION_MINUTES)
    pending_cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)

    conflicting = db.query(Booking).filter(
        Booking.teacher_id == payload.teacher_id,
        or_(
            Booking.status == BookingStatus.confirmed,
            and_(Booking.status == BookingStatus.pending, Booking.created_at >= pending_cutoff),
        ),
        Booking.scheduled_at < slot_end,
    ).all()
    for b in conflicting:
        if payload.scheduled_at < b.scheduled_at + timedelta(minutes=b.duration_minutes):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Teacher is not available at that time")

    amount = float(teacher.hourly_rate) * (CLASS_DURATION_MINUTES / 60)  # billed on actual class time, not the buffer

    booking = Booking(
        student_id=student_id, teacher_id=payload.teacher_id, subject_id=payload.subject_id,
        scheduled_at=payload.scheduled_at, duration_minutes=SLOT_DURATION_MINUTES,
        status=BookingStatus.pending, price=amount,
    )
    db.add(booking)
    db.flush()

    payment = Payment(
        booking_id=booking.id, payer_id=current_user.id, amount=amount,
        currency="INR" if payload.provider == "razorpay" else "usd",
        provider=PaymentProvider(payload.provider), status=PaymentStatus.created,
    )
    db.add(payment)
    db.flush()

    response = CheckoutResponse(booking_id=booking.id, payment_id=payment.id, provider=payload.provider)

    if payload.provider == "razorpay":
        amount_paise = int(round(amount * 100))
        order = razorpay_service.create_order(amount_paise, "INR", receipt=str(payment.id))
        payment.provider_order_id = order["id"]
        response.razorpay = RazorpayOrderInfo(order_id=order["id"], key_id=settings.RAZORPAY_KEY_ID, amount=amount_paise, currency="INR")
    else:
        amount_cents = int(round(amount * 100))
        intent = stripe_service.create_payment_intent(amount_cents, "usd", metadata={"payment_id": str(payment.id), "booking_id": str(booking.id)})
        payment.provider_order_id = intent.id
        response.stripe = StripeOrderInfo(client_secret=intent.client_secret, publishable_key=settings.STRIPE_PUBLISHABLE_KEY, amount=amount_cents, currency="usd")

    db.commit()
    return response


def _confirm_booking(payment: Payment, db: Session):
    payment.status = PaymentStatus.paid
    booking = db.get(Booking, payment.booking_id)
    booking.status = BookingStatus.confirmed
    db.add(ClassSession(booking_id=booking.id, livekit_room_name=f"dexmy-{booking.id}", status=SessionStatus.scheduled))
    db.commit()


@router.post("/razorpay/verify")
def verify_razorpay_payment(payload: RazorpayVerifyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = db.get(Payment, payload.payment_id)
    if payment is None or payment.payer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.status == PaymentStatus.paid:
        return {"status": "already_confirmed"}

    if not razorpay_service.verify_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        payment.status = PaymentStatus.failed
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment verification failed")

    payment.provider_payment_id = payload.razorpay_payment_id
    _confirm_booking(payment, db)
    return {"status": "confirmed"}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe_service.construct_webhook_event(payload, sig_header)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        payment = db.query(Payment).filter(Payment.provider_order_id == intent["id"]).first()
        if payment and payment.status != PaymentStatus.paid:
            payment.provider_payment_id = intent["id"]
            _confirm_booking(payment, db)

    return {"received": True}