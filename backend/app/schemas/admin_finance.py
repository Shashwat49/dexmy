from decimal import Decimal

from pydantic import BaseModel


class FinanceSummary(BaseModel):
    total_paid: Decimal
    total_refunded: Decimal
    created_payments: int
    failed_payments: int
    paid_payments: int
    refunded_payments: int
    draft_payouts: int
    approved_payouts: int
    held_payouts: int
    paid_payouts: int
    outstanding_payout_amount: Decimal
