import uuid
from datetime import time, datetime

from pydantic import BaseModel, ConfigDict


class AvailabilityCreate(BaseModel):
    day_of_week: int  # 0 = Sunday .. 6 = Saturday
    start_time: time
    end_time: time


class AvailabilityRead(AvailabilityCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    teacher_id: uuid.UUID
    is_recurring: bool


class SlotRead(BaseModel):
    start_time: datetime
    end_time: datetime