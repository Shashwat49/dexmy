from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.payout import TeacherPayout, TeacherPayoutAccount
from app.models.user import User
from app.schemas.admin_payouts import PayoutAccountRead, PayoutAccountVerification, PayoutRead
from app.services.audit_service import record_admin_action

router = APIRouter()


@router.get("/accounts", response_model=list[PayoutAccountRead])
def list_payout_accounts(
    verification_status: str | None = None,
    current_user: User = Depends(require_permission("payout.read")),
    db: Session = Depends(get_db),
):
    query = select(TeacherPayoutAccount).order_by(TeacherPayoutAccount.created_at.desc())
    if verification_status:
        query = query.where(TeacherPayoutAccount.verification_status == verification_status)
    return db.execute(query).scalars().all()


@router.patch("/accounts/{teacher_id}/verify", response_model=PayoutAccountRead)
def verify_payout_account(
    teacher_id: UUID,
    payload: PayoutAccountVerification,
    current_user: User = Depends(require_permission("payout.approve")),
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(TeacherPayoutAccount).where(TeacherPayoutAccount.teacher_id == teacher_id).with_for_update()
    ).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout account not found")
    if payload.approved:
        account.verification_status = "verified"
        account.rejection_reason = None
        account.verified_by = current_user.id
        account.verified_at = datetime.now().astimezone()
    else:
        if not payload.reason or len(payload.reason.strip()) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A rejection reason is required")
        account.verification_status = "rejected"
        account.rejection_reason = payload.reason.strip()
        account.verified_by = current_user.id
        account.verified_at = datetime.now().astimezone()
    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="payout_account.verify" if payload.approved else "payout_account.reject",
        resource_type="teacher_payout_account",
        resource_id=account.id,
        new_values={"verification_status": account.verification_status},
        reason=payload.reason,
    )
    db.commit()
    db.refresh(account)
    return account


@router.get("", response_model=list[PayoutRead])
def list_payouts(
    teacher_id: UUID | None = None,
    payout_status: str | None = None,
    current_user: User = Depends(require_permission("payout.read")),
    db: Session = Depends(get_db),
):
    query = select(TeacherPayout).order_by(TeacherPayout.period_end.desc())
    if teacher_id:
        query = query.where(TeacherPayout.teacher_id == teacher_id)
    if payout_status:
        query = query.where(TeacherPayout.status == payout_status)
    return db.execute(query).scalars().all()


@router.post("/{payout_id}/approve", response_model=PayoutRead)
def approve_payout(
    payout_id: UUID,
    current_user: User = Depends(require_permission("payout.approve")),
    db: Session = Depends(get_db),
):
    payout = db.execute(select(TeacherPayout).where(TeacherPayout.id == payout_id).with_for_update()).scalar_one_or_none()
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")
    if payout.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft payouts can be approved")
    payout.status = "approved"
    payout.approved_by = current_user.id
    payout.approved_at = datetime.now().astimezone()
    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="payout.approve",
        resource_type="teacher_payout",
        resource_id=payout.id,
        new_values={"status": "approved", "net_amount": str(payout.net_amount)},
    )
    db.commit()
    db.refresh(payout)
    return payout


@router.post("/{payout_id}/hold", response_model=PayoutRead)
def hold_payout(
    payout_id: UUID,
    current_user: User = Depends(require_permission("payout.hold")),
    db: Session = Depends(get_db),
):
    payout = db.execute(select(TeacherPayout).where(TeacherPayout.id == payout_id).with_for_update()).scalar_one_or_none()
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")
    if payout.status not in {"draft", "approved"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This payout cannot be put on hold")
    payout.status = "held"
    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="payout.hold",
        resource_type="teacher_payout",
        resource_id=payout.id,
        new_values={"status": "held"},
    )
    db.commit()
    db.refresh(payout)
    return payout


@router.post("/{payout_id}/mark-paid", response_model=PayoutRead)
def mark_payout_paid(
    payout_id: UUID,
    external_reference: str,
    current_user: User = Depends(require_permission("payout.approve")),
    db: Session = Depends(get_db),
):
    """Record a payout as completed after an external transfer succeeds.

    This endpoint does not move money itself. The external transfer must be
    completed through the configured bank/UPI process first, and its reference
    must be supplied for reconciliation.
    """
    reference = external_reference.strip()
    if not reference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="External payout reference is required")

    payout = db.execute(
        select(TeacherPayout).where(TeacherPayout.id == payout_id).with_for_update()
    ).scalar_one_or_none()
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")
    if payout.status != "approved":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only approved payouts can be marked paid")
    if payout.external_reference:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payout already has an external reference")

    payout.status = "paid"
    payout.external_reference = reference
    payout.paid_at = datetime.now().astimezone()
    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="payout.mark_paid",
        resource_type="teacher_payout",
        resource_id=payout.id,
        new_values={"status": "paid", "external_reference": reference},
    )
    db.commit()
    db.refresh(payout)
    return payout
