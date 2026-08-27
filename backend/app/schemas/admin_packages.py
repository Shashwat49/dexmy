import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PackagePlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    class_count: int = Field(ge=25)
    price: Decimal = Field(ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    is_custom: bool = False
    is_active: bool = True

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.upper()
        if value not in {"INR", "USD"}:
            raise ValueError("Currency must be INR or USD")
        return value

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class PackagePlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    class_count: int | None = Field(default=None, ge=25)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    is_custom: bool | None = None
    is_active: bool | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.upper()
        if value not in {"INR", "USD"}:
            raise ValueError("Currency must be INR or USD")
        return value

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class PackagePlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    class_count: int
    price: Decimal
    currency: str
    is_custom: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
