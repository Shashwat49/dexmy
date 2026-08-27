import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import ContactMessage, DemoRequest, DemoStatus
from app.models.user import User
from app.schemas.booking import DemoRequestCreate, DemoRequestRead
from app.schemas.marketing import ContactMessageCreate, ContactMessageRead
from app.services.audit_service import record_admin_action

router = APIRouter()


# ---------- Demo requests ----------

@router.post(
    "/demo-requests",
    response_model=DemoRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_demo_request(
    payload: DemoRequestCreate,
    db: Session = Depends(get_db),
):
    # Public endpoint: no admin authorization here.
    demo = DemoRequest(**payload.model_dump())
    db.add(demo)
    db.commit()
    db.refresh(demo)
    return demo


@router.get(
    "/demo-requests",
    response_model=list[DemoRequestRead],
)
def list_demo_requests(
    current_user: User = Depends(require_permission("demo.read")),
    db: Session = Depends(get_db),
):
    return (
        db.query(DemoRequest)
        .order_by(DemoRequest.created_at.desc())
        .all()
    )


@router.patch(
    "/demo-requests/{demo_id}/status",
    response_model=DemoRequestRead,
)
def update_demo_status(
    demo_id: uuid.UUID,
    new_status: DemoStatus,
    request: Request,
    current_user: User = Depends(require_permission("demo.update")),
    db: Session = Depends(get_db),
):
    demo = db.get(DemoRequest, demo_id)
    if demo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo request not found",
        )

    old_status = demo.status.value
    demo.status = new_status

    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="demo.status_update",
        resource_type="demo_request",
        resource_id=demo.id,
        old_values={"status": old_status},
        new_values={"status": new_status.value},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    db.commit()
    db.refresh(demo)
    return demo


# ---------- Contact form ----------

@router.post(
    "/contact",
    response_model=ContactMessageRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_contact_message(
    payload: ContactMessageCreate,
    db: Session = Depends(get_db),
):
    # Public endpoint: no admin authorization here.
    msg = ContactMessage(**payload.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get(
    "/contact",
    response_model=list[ContactMessageRead],
)
def list_contact_messages(
    current_user: User = Depends(require_permission("support.read")),
    db: Session = Depends(get_db),
):
    return (
        db.query(ContactMessage)
        .order_by(ContactMessage.created_at.desc())
        .all()
    )


@router.patch(
    "/contact/{message_id}/resolve",
    response_model=ContactMessageRead,
)
def resolve_contact_message(
    message_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("support.resolve")),
    db: Session = Depends(get_db),
):
    msg = db.get(ContactMessage, message_id)
    if msg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )

    if msg.is_resolved:
        return msg

    msg.is_resolved = True

    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="support.contact_resolve",
        resource_type="contact_message",
        resource_id=msg.id,
        old_values={"is_resolved": False},
        new_values={"is_resolved": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    db.commit()
    db.refresh(msg)
    return msg
