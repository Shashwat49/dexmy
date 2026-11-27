import uuid
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.payment import Payment, PaymentStatus
from app.services import razorpay_service
from app.services.package_payment_service import activate_package_from_payment

router = APIRouter()


def _minor_units(amount) -> int:
    return int((Decimal(str(amount)) * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


@router.post("/razorpay/webhook")
async def razorpay_package_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    if not signature or not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay webhook is not configured")
    if not razorpay_service.verify_webhook_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Razorpay webhook signature")

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload")

    if event.get("event") not in {"payment.captured", "order.paid", "payment.failed"}:
        return {"received": True}

    payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_entity = event.get("payload", {}).get("order", {}).get("entity", {})
    order_id = payment_entity.get("order_id") or order_entity.get("id")
    provider_payment_id = payment_entity.get("id")
    if not order_id:
        return {"received": True}

    payment = db.execute(
        select(Payment).where(Payment.provider_order_id == order_id).with_for_update()
    ).scalar_one_or_none()
    if payment is None:
        # The provider can emit the webhook before checkout commits the order ID.
        # Razorpay's order receipt is the internal payment UUID created by Dexmy.
        pending_order = razorpay_service.fetch_order(order_id)
        receipt = pending_order.get("receipt")
        try:
            receipt_payment_id = uuid.UUID(str(receipt))
        except (TypeError, ValueError):
            return {"received": True}
        payment = db.execute(
            select(Payment).where(Payment.id == receipt_payment_id).with_for_update()
        ).scalar_one_or_none()
        if payment is None:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Package payment record is not committed yet")
        if payment.provider_order_id not in (None, order_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay order does not match the package payment")
        payment.provider_order_id = order_id
    if payment.provider.value != "razorpay":
        return {"received": True}
    if payment.status == PaymentStatus.paid:
        return {"received": True}

    if event.get("event") == "payment.failed":
        payment.status = PaymentStatus.failed
        db.commit()
        return {"received": True}

    order = razorpay_service.fetch_order(order_id)
    expected_amount = _minor_units(payment.amount)
    if order.get("amount") != expected_amount or order.get("currency") != payment.currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay payment amount or currency mismatch")
    if event.get("event") == "payment.captured":
        if payment_entity.get("status") != "captured" or payment_entity.get("amount") != expected_amount or payment_entity.get("currency") != payment.currency:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay captured payment details do not match")
    elif order.get("status") != "paid" or order.get("amount_paid") != expected_amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay order is not fully paid")

    try:
        activate_package_from_payment(db, payment_id=payment.id, provider_payment_id=provider_payment_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_409_CONFLICT and "previous per-class checkout amount" in str(exc.detail):
            payment.status = PaymentStatus.failed
            db.commit()
            return {"received": True}
        raise
    db.commit()
    return {"received": True}
