from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from app.services.invoice_pdf import render_payment_invoice


def test_invoice_pdf_uses_persisted_payment_amount_and_snapshot():
    payment = SimpleNamespace(
        id="payment-ref-123",
        created_at=datetime(2026, 11, 28, 10, 30, tzinfo=timezone.utc),
        status="paid",
        provider="razorpay",
        package_class_count=25,
        amount=Decimal("50000.00"),
        currency="INR",
        provider_payment_id="provider-ref-456",
        provider_order_id="order-ref-789",
    )

    pdf = render_payment_invoice(payment, payer_name="Payer Name", student_name="Student Name")

    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000
    assert b"%%EOF" in pdf
