from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
    )

    description: str | None = None


class SubjectRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    name: str
    description: str | None