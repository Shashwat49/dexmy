from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    admin_dashboard,
    admin_teachers,
    auth,
    bookings,
    classroom,
    marketing,
    parents,
    students,
    teachers,
    users,
    payments,
    system,
    profiles,
    subjects,
    whatsapp
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(classroom.router, prefix="/classroom", tags=["classroom"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(parents.router, prefix="/parents", tags=["parents"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(marketing.router, tags=["marketing"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(admin_dashboard.router, prefix="/admin/dashboard", tags=["admin-dashboard"])
api_router.include_router(admin_teachers.router, prefix="/admin/teachers", tags=["admin-teachers"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
api_router.include_router(whatsapp.router, prefix='/whatsapp', tags=["whatsapp"])
