import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClassReviewCreate(BaseModel):
    checked_points: list[str] = Field(default_factory=list)
    additional_opinion: str | None = Field(default=None, max_length=5000)


class ClassReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewee_id: uuid.UUID
    reviewer_role: str
    checked_points: list[str]
    additional_opinion: str | None
    created_at: datetime
