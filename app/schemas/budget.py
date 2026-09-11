from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BudgetBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    category_id: str | None = None


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    amount: float | None = Field(default=None, gt=0)
    month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    category_id: str | None = None


class BudgetRead(BudgetBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    spent: float = 0
    created_at: datetime
