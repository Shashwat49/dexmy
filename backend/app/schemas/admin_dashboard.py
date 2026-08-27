from pydantic import BaseModel


class AdminDashboardMetrics(BaseModel):
    total_students: int
    total_teachers: int
    active_students: int
    verified_teachers: int
    upcoming_bookings: int
    pending_teacher_assignments: int
    unresolved_contact_messages: int
    pending_payments: int


class AdminDashboardResponse(BaseModel):
    metrics: AdminDashboardMetrics
