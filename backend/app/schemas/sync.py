from datetime import datetime
from typing import Any, Literal

from pydantic import Field, field_validator

from app.schemas.card import CardRead
from app.schemas.common import CamelModel, parse_iso_datetime
from app.schemas.expenses import MAX_RECURRING_MONTHS, MAX_SKIPPED_MONTHS, ExpenseRead, normalize_skipped_months

MutationType = Literal[
    "CREATE_EXPENSE",
    "UPDATE_EXPENSE",
    "DELETE_EXPENSE",
    "TOGGLE_PAID",
    "CREATE_CARD",
    "UPDATE_CARD",
    "DELETE_CARD",
]

MAX_MUTATIONS_PER_BATCH = 500
MAX_BACKUP_ITEMS = 20_000


class Mutation(CamelModel):
    type: MutationType
    id: str | None = Field(default=None, max_length=36)
    data: dict[str, Any] | None = None
    client_updated_at: datetime | None = Field(default=None, description="Local updatedAt used for Last-Write-Wins")

    _client_updated_at = field_validator("client_updated_at", mode="before")(parse_iso_datetime)


class SyncBatchRequest(CamelModel):
    last_sync_timestamp: datetime | None = None
    mutations: list[Mutation] = Field(default_factory=list, max_length=MAX_MUTATIONS_PER_BATCH)

    _last_sync = field_validator("last_sync_timestamp", mode="before")(parse_iso_datetime)


class SyncConflict(CamelModel):
    type: MutationType
    id: str | None = None
    reason: str
    server: dict[str, Any] | None = None


class SyncApplied(CamelModel):
    type: MutationType
    id: str


class ServerChanges(CamelModel):
    expenses: list[ExpenseRead]
    cards: list[CardRead]


class SyncBatchResponse(CamelModel):
    synced_at: datetime
    applied: list[SyncApplied]
    server_changes: ServerChanges
    conflicts: list[SyncConflict]


class BackupCard(CamelModel):
    id: str = Field(min_length=1, max_length=36)
    holder_name: str = Field(min_length=1, max_length=120)
    brand: str = "generic"
    type: str = "Credit"
    last_digits: str = Field(pattern=r"^\d{1,4}$")
    expiry_date: str = Field(pattern=r"^(0[1-9]|1[0-2])/\d{2}$")
    limit: float = Field(ge=0)
    color_accent: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    _created = field_validator("created_at", mode="before")(parse_iso_datetime)
    _updated = field_validator("updated_at", mode="before")(parse_iso_datetime)


class BackupExpense(CamelModel):
    id: str = Field(min_length=1, max_length=36)
    description: str = Field(min_length=1, max_length=255)
    amount: float = Field(gt=0)
    person: str = Field(min_length=1, max_length=120)
    date: datetime
    tags: list[str] = Field(default_factory=list)
    paid: bool = False
    source: Literal["manual", "notification", "import"] | None = None
    card_id: str | None = None
    recurring: bool = False
    recurring_months: int | None = Field(default=None, ge=0, le=MAX_RECURRING_MONTHS)
    recurring_source_id: str | None = Field(default=None, max_length=36)
    skipped_months: list[str] = Field(default_factory=list, max_length=MAX_SKIPPED_MONTHS)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    _date = field_validator("date", mode="before")(parse_iso_datetime)
    _skipped = field_validator("skipped_months", mode="before")(normalize_skipped_months)
    _created = field_validator("created_at", mode="before")(parse_iso_datetime)
    _updated = field_validator("updated_at", mode="before")(parse_iso_datetime)


class BackupPayload(CamelModel):
    """Exact shape of the JSON file exported by the mobile app (BackupData)."""

    version: str = Field(default="1.0.0", max_length=20)
    exported_at: datetime | None = None
    cards: list[BackupCard] = Field(default_factory=list, max_length=MAX_BACKUP_ITEMS)
    expenses: list[BackupExpense] = Field(default_factory=list, max_length=MAX_BACKUP_ITEMS)

    _exported = field_validator("exported_at", mode="before")(parse_iso_datetime)


class ImportResult(CamelModel):
    cards_created: int
    cards_updated: int
    expenses_created: int
    expenses_updated: int
    warnings: list[dict[str, Any]]


class BackupExport(CamelModel):
    version: str
    exported_at: datetime
    cards: list[CardRead]
    expenses: list[ExpenseRead]
