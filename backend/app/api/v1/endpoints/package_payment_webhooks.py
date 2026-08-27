from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.payment import Payment, PaymentStatus
from app.services import razorpay_service
from app.services.package_payment_service import activate_package_from_payment

router = APIRouter()


@router.post("/razorpay/webhook")
async def razorpay_package_webhook(request: Request, db: Session = __import__("fastapi").Depends(get_db)):
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

    if event.get("event") not in {"payment.captured", "order.paid"}:
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
    if payment is None or payment.provider.value != "razorpay":
        return {"received": True}
    if payment.status == PaymentStatus.paid:
        return {"received": True}

    order = razorpay_service.fetch_order(order_id)
    expected_amount = int(round(float(payment.amount) * 100))
    if order.get("amount") != expected_amount or order.get("currency") != payment.currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay payment amount or currency mismatch")

    activate_package_from_payment(db, payment_id=payment.id, provider_payment_id=provider_payment_id)
    db.commit()
    return {"received": True}
