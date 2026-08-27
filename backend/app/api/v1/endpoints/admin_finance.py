from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.payment import Payment, PaymentStatus
from app.models.payout import TeacherPayout
from app.models.user import User
from app.schemas.admin_finance import FinanceSummary

router = APIRouter()


@router.get("/summary", response_model=FinanceSummary)
def finance_summary(
    current_user: User = Depends(require_permission("payment.read")),
    db: Session = Depends(get_db),
):
    totals = db.execute(
        select(
            func.coalesce(func.sum(Payment.amount).filter(Payment.status == PaymentStatus.paid), 0),
            func.coalesce(func.sum(Payment.amount).filter(Payment.status == PaymentStatus.refunded), 0),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.created),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.failed),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.paid),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.refunded),
        )
    ).one()

    payout_counts = db.execute(
        select(
            func.count(TeacherPayout.id).filter(TeacherPayout.status == "draft"),
            func.count(TeacherPayout.id).filter(TeacherPayout.status == "approved"),
            func.count(TeacherPayout.id).filter(TeacherPayout.status == "held"),
            func.count(TeacherPayout.id).filter(TeacherPayout.status == "paid"),
            func.coalesce(
                func.sum(TeacherPayout.net_amount).filter(
                    TeacherPayout.status.in_(["draft", "approved", "processing", "held"])
                ),
                0,
            ),
        )
    ).one()

    return FinanceSummary(
        total_paid=totals[0],
        total_refunded=totals[1],
        created_payments=totals[2],
        failed_payments=totals[3],
        paid_payments=totals[4],
        refunded_payments=totals[5],
        draft_payouts=payout_counts[0],
        approved_payouts=payout_counts[1],
        held_payouts=payout_counts[2],
        paid_payouts=payout_counts[3],
        outstanding_payout_amount=payout_counts[4],
    )
