from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.package import PackagePlan
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


@router.get("/payments")
def list_payments(
    page: int = 1,
    page_size: int = 50,
    status_filter: PaymentStatus | None = None,
    current_user: User = Depends(require_permission("payment.read")),
    db: Session = Depends(get_db),
):
    query = (
        select(
            Payment,
            User.full_name.label("student_name"),
            PackagePlan.name.label("package_name"),
        )
        .outerjoin(User, Payment.student_id == User.id)
        .outerjoin(PackagePlan, Payment.package_plan_id == PackagePlan.id)
        .order_by(Payment.created_at.desc())
    )
    if status_filter:
        query = query.where(Payment.status == status_filter)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    results = db.execute(query.offset((page - 1) * page_size).limit(page_size)).all()

    items = []
    for payment, student_name, package_name in results:
        items.append({
            "id": str(payment.id),
            "student_id": str(payment.student_id) if payment.student_id else None,
            "student_name": student_name,
            "package_id": str(payment.package_id) if payment.package_id else None,
            "package_plan_id": str(payment.package_plan_id) if payment.package_plan_id else None,
            "package_name": package_name,
            "amount": float(payment.amount),
            "currency": payment.currency,
            "provider": payment.provider.value if hasattr(payment.provider, "value") else str(payment.provider),
            "provider_order_id": payment.provider_order_id,
            "provider_payment_id": payment.provider_payment_id,
            "status": payment.status.value if hasattr(payment.status, "value") else str(payment.status),
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
        })

    return {"items": items, "total": total or 0, "page": page, "page_size": page_size}
