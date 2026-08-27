# Thin wrapper around the Razorpay REST API.
import hashlib
import hmac

import requests

from app.core.config import settings

RAZORPAY_BASE_URL = "https://api.razorpay.com/v1"


def create_order(amount_in_paise: int, currency: str, receipt: str) -> dict:
    response = requests.post(
        f"{RAZORPAY_BASE_URL}/orders",
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        json={
            "amount": amount_in_paise,
            "currency": currency,
            "receipt": receipt,
            "payment_capture": 1,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def fetch_order(order_id: str) -> dict:
    response = requests.get(
        f"{RAZORPAY_BASE_URL}/orders/{order_id}",
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    payload = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
