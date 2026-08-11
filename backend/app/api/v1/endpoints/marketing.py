import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.booking import DemoRequest, DemoStatus, ContactMessage
from app.models.user import User, UserRole
from app.schemas.booking import DemoRequestCreate, DemoRequestRead
from app.schemas.marketing import ContactMessageCreate, ContactMessageRead

router = APIRouter()


# ---------- Demo requests ----------

@router.post("/demo-requests", response_model=DemoRequestRead, status_code=status.HTTP_201_CREATED)
def submit_demo_request(payload: DemoRequestCreate, db: Session = Depends(get_db)):
    demo = DemoRequest(**payload.model_dump())
    db.add(demo)
    db.commit()
    db.refresh(demo)
    return demo


@router.get("/demo-requests", response_model=list[DemoRequestRead])
def list_demo_requests(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(DemoRequest).order_by(DemoRequest.created_at.desc()).all()


@router.patch("/demo-requests/{demo_id}/status", response_model=DemoRequestRead)
def update_demo_status(
    demo_id: uuid.UUID,
    new_status: DemoStatus,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    demo = db.get(DemoRequest, demo_id)
    if demo is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo request not found")
    demo.status = new_status
    db.commit()
    db.refresh(demo)
    return demo


# ---------- Contact form ----------

@router.post("/contact", response_model=ContactMessageRead, status_code=status.HTTP_201_CREATED)
def submit_contact_message(payload: ContactMessageCreate, db: Session = Depends(get_db)):
    msg = ContactMessage(**payload.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/contact", response_model=list[ContactMessageRead])
def list_contact_messages(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).all()


@router.patch("/contact/{message_id}/resolve", response_model=ContactMessageRead)
def resolve_contact_message(
    message_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    msg = db.get(ContactMessage, message_id)
    if msg is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    msg.is_resolved = True
    db.commit()
    db.refresh(msg)
    return msg