import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict


class ContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    message: str


class ContactMessageRead(ContactMessageCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_resolved: bool
    created_at: datetime