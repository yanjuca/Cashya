from datetime import date, datetime, timezone
from decimal import Decimal

from pydantic import BaseModel


def to_iso_utc(value: datetime) -> str:
    """Serialize datetimes as ISO 8601 in UTC with a trailing Z, matching the mobile contract."""
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def serialize_data(data: object) -> object:
    if isinstance(data, Decimal):
        return float(data)
    if isinstance(data, datetime):
        return to_iso_utc(data)
    if isinstance(data, date):
        return data.isoformat()
    if isinstance(data, BaseModel):
        return serialize_data(data.model_dump(by_alias=True))
    if isinstance(data, (list, tuple)):
        return [serialize_data(item) for item in data]
    if isinstance(data, dict):
        return {key: serialize_data(value) for key, value in data.items()}
    return data


def envelope(data: object = None, message: str | None = None) -> dict:
    result = {"success": True, "data": serialize_data(data)}
    if message is not None:
        result["message"] = message
    return result
