from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)


class CategoryRead(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
