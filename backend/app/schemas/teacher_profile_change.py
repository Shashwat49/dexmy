import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeacherProfileChangeRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    teacher_id: uuid.UUID
    requested_changes: dict
    status: str
    reviewed_by: uuid.UUID | None = None
    review_reason: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class TeacherProfileChangeReview(BaseModel):
    approved: bool
    reason: str | None = None
