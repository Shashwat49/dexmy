import stripe

from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_payment_intent(amount_in_cents: int, currency: str, metadata: dict):
    return stripe.PaymentIntent.create(
        amount=amount_in_cents,
        currency=currency,
        metadata=metadata,
        automatic_payment_methods={"enabled": True},
    )


def construct_webhook_event(payload: bytes, sig_header: str):
    return stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)