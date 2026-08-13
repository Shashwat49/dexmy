import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import WebSocket


@dataclass
class RoomState:
    teacher_ws: WebSocket | None = None
    student_ws: WebSocket | None = None
    pending_student: WebSocket | None = None
    permissions: dict[str, set[str]] = field(default_factory=dict)
    deadline: datetime | None = None       # wall-clock time this class must end by
    extended: bool = False                  # whether the one-time 5-min extension has been used
    warned: bool = False                    # whether the 2-min extend-prompt has already fired
    timer_task: "asyncio.Task | None" = None  # keeps the background timer alive / referenced


class ClassroomConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[uuid.UUID, RoomState] = {}

    def get_room(self, session_id: uuid.UUID) -> RoomState:
        if session_id not in self.rooms:
            self.rooms[session_id] = RoomState()
        return self.rooms[session_id]

    def drop_room_if_empty(self, session_id: uuid.UUID) -> None:
        room = self.rooms.get(session_id)
        if room and not room.teacher_ws and not room.student_ws and not room.pending_student:
            del self.rooms[session_id]


manager = ClassroomConnectionManager()