from pydantic import BaseModel


class Summary(BaseModel):
    total: float
    paid: float
    pending: float
    count: int
    average: float


class GroupTotal(BaseModel):
    name: str
    total: float
    pending: float = 0
    count: int


class MonthTotal(BaseModel):
    month: str
    total: float


class StatisticsRead(BaseModel):
    summary: Summary
    by_person: list[GroupTotal]
    by_tag: list[GroupTotal]
    by_month: list[MonthTotal]
