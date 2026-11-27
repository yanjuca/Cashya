from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that accepts/produces camelCase keys (the mobile contract) and snake_case attributes."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True, str_strip_whitespace=True)


def parse_iso_datetime(value: object) -> datetime | None:
    """Accept ISO 8601 datetimes or plain dates; naive values are treated as UTC."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return ensure_utc(value)
    if isinstance(value, str):
        text = value.strip()
        if len(text) == 10:
            return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
        return ensure_utc(datetime.fromisoformat(text.replace("Z", "+00:00")))
    raise ValueError("value must be an ISO 8601 datetime")


def ensure_utc(value: datetime) -> datetime:
    """Normalize to an aware UTC datetime so values compare safely with what SQLite stores (UTC wall time)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class Pagination(CamelModel):
    page: int
    limit: int
    total: int
    total_pages: int
    has_next: bool
