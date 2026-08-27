import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.payment import Payment, PaymentStatus
from app.models.student import ParentStudentLink
from app.models.user import User, UserRole
from app.schemas.package_payment import (
    PackageCheckoutRequest,
    PackageCheckoutResponse,
    PackageRazorpayVerifyRequest,
)
from app.services import razorpay_service, stripe_service
from app.services.package_payment_service import activate_package_from_payment, get_or_create_payment, get_package_plan

router = APIRouter()


def _resolve_student_id(current_user: User, requested_student_id: uuid.UUID | None, db: Session) -> uuid.UUID:
    if current_user.role == UserRole.student:
        if requested_student_id is not None and requested_student_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students can only purchase packages for themselves")
        return current_user.id
    if current_user.role == UserRole.parent:
        if requested_student_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_id is required for a parent purchase")
        if db.get(ParentStudentLink, (current_user.id, requested_student_id)) is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not linked to this student")
        return requested_student_id
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students or parents can purchase packages")


def _response_for_payment(payment: Payment, plan, *, razorpay_order_id=None, stripe_client_secret=None, razorpay_amount=None, stripe_amount=None):
    return PackageCheckoutResponse(
        payment_id=payment.id,
        package_plan_id=plan.id,
        provider=payment.provider.value,
        amount=Decimal(str(payment.amount)),
        currency=payment.currency,
        razorpay_order_id=razorpay_order_id,
        razorpay_key_id=settings.RAZORPAY_KEY_ID if razorpay_order_id else None,
        razorpay_amount=razorpay_amount,
        stripe_client_secret=stripe_client_secret,
        stripe_publishable_key=settings.STRIPE_PUBLISHABLE_KEY if stripe_client_secret else None,
        stripe_amount=stripe_amount,
    )


@router.post("/checkout", response_model=PackageCheckoutResponse, status_code=status.HTTP_201_CREATED)
def package_checkout(
    payload: PackageCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student_id = _resolve_student_id(current_user, payload.student_id, db)
    plan = get_package_plan(db, payload.package_plan_id)

    payment = get_or_create_payment(
        db,
        payer_id=student_id,
        package_plan=plan,
        provider=payload.provider,
        idempotency_key=payload.idempotency_key,
    )

    if payment.status == PaymentStatus.paid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This package payment has already been completed")

    if payment.provider_order_id:
        if payment.provider.value == "razorpay":
            return _response_for_payment(
                payment,
                plan,
                razorpay_order_id=payment.provider_order_id,
                razorpay_amount=int(round(float(payment.amount) * 100)),
            )
        intent = stripe_service.retrieve_payment_intent(payment.provider_order_id)
        return _response_for_payment(
            payment,
            plan,
            stripe_client_secret=intent.client_secret,
            stripe_amount=int(round(float(payment.amount) * 100)),
        )

    try:
        if payload.provider == "razorpay":
            amount_paise = int(round(float(plan.price) * 100))
            order = razorpay_service.create_order(amount_paise, "INR", receipt=str(payment.id))
            payment.provider_order_id = order["id"]
            db.commit()
            return _response_for_payment(
                payment,
                plan,
                razorpay_order_id=order["id"],
                razorpay_amount=amount_paise,
            )

        amount_cents = int(round(float(plan.price) * 100))
        intent = stripe_service.create_payment_intent(
            amount_cents,
            "usd",
            metadata={
                "payment_id": str(payment.id),
                "package_plan_id": str(plan.id),
                "student_id": str(student_id),
            },
            idempotency_key=str(payload.idempotency_key),
        )
        payment.provider_order_id = intent.id
        db.commit()
        return _response_for_payment(
            payment,
            plan,
            stripe_client_secret=intent.client_secret,
            stripe_amount=amount_cents,
        )
    except Exception:
        db.rollback()
        payment = db.get(Payment, payment.id)
        if payment is not None and payment.status == PaymentStatus.created:
            payment.status = PaymentStatus.failed
            db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to create payment with the selected provider")


@router.post("/razorpay/verify")
def verify_package_razorpay(
    payload: PackageRazorpayVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.get(Payment, payload.payment_id)
    if payment is None or payment.payer_id != current_user.id or payment.provider.value != "razorpay":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.status == PaymentStatus.paid:
        return {"status": "already_confirmed"}
    if payment.provider_order_id != payload.razorpay_order_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order does not match payment")
    if not razorpay_service.verify_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        payment.status = PaymentStatus.failed
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment verification failed")

    order = razorpay_service.fetch_order(payload.razorpay_order_id)
    expected_amount = int(round(float(payment.amount) * 100))
    if order.get("amount") != expected_amount or order.get("currency") != payment.currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount or currency does not match the package")

    activate_package_from_payment(db, payment_id=payment.id, provider_payment_id=payload.razorpay_payment_id)
    db.commit()
    return {"status": "confirmed"}


@router.post("/stripe/webhook")
async def package_stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    try:
        event = stripe_service.construct_webhook_event(payload, signature)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        payment = db.execute(
            select(Payment).where(Payment.provider_order_id == intent["id"]).with_for_update()
        ).scalar_one_or_none()
        if payment is not None and payment.status != PaymentStatus.paid:
            if payment.provider.value != "stripe":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment provider mismatch")
            expected_amount = int(round(float(payment.amount) * 100))
            if intent.get("amount") != expected_amount or intent.get("currency") != payment.currency.lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount or currency mismatch")
            activate_package_from_payment(db, payment_id=payment.id, provider_payment_id=intent["id"])
            db.commit()

    return {"received": True}
