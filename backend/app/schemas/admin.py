import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole


ADMIN_ROLES = {
    UserRole.super_admin,
    UserRole.admin,
    UserRole.academic_manager,
    UserRole.teacher_manager,
    UserRole.finance_manager,
    UserRole.support_agent,
}


class AdminMeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: str | None
    role: UserRole
    is_active: bool
    email_verified: bool
    employee_id: str | None = None
    department: str | None = None
    permissions: list[str]


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=72)
    role: UserRole
    employee_id: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: UserRole) -> UserRole:
        if value not in ADMIN_ROLES:
            raise ValueError("Role must be an administrative role")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters")
        return value


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    role: UserRole | None = None
    employee_id: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: UserRole | None) -> UserRole | None:
        if value is not None and value not in ADMIN_ROLES:
            raise ValueError("Role must be an administrative role")
        return value


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: str | None
    role: UserRole
    is_active: bool
    email_verified: bool
    created_at: datetime
    employee_id: str | None = None
    department: str | None = None


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    admin_user_id: uuid.UUID
    action: str
    resource_type: str
    resource_id: str | None
    old_values: dict | None
    new_values: dict | None
    reason: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
