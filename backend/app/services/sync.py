from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.expense import Expense
from app.models.user import User
from app.schemas.card import CardCreate, CardPatch, CardRead
from app.schemas.card import normalize_type as normalize_card_type
from app.schemas.common import ensure_utc
from app.schemas.expenses import ExpenseCreate, ExpensePatch, ExpenseRead
from app.schemas.sync import BackupExport, BackupPayload, ImportResult, Mutation, ServerChanges, SyncApplied, SyncBatchRequest, SyncBatchResponse, SyncConflict
from app.services import cards as card_service
from app.services import expenses as expense_service

BACKUP_VERSION = "1.0.0"


def _server_wins(server_updated_at: datetime, client_updated_at: datetime | None) -> bool:
    """Last-Write-Wins: the server copy stays when it is newer than the client's local version."""
    if client_updated_at is None:
        return False
    return ensure_utc(server_updated_at) > ensure_utc(client_updated_at)


def _validation_reason(error: ValidationError) -> str:
    return "; ".join(f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}" for item in error.errors())


class BatchProcessor:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self.applied: list[SyncApplied] = []
        self.conflicts: list[SyncConflict] = []

    def run(self, payload: SyncBatchRequest) -> SyncBatchResponse:
        handlers = {
            "CREATE_EXPENSE": self.create_expense,
            "UPDATE_EXPENSE": self.update_expense,
            "DELETE_EXPENSE": self.delete_expense,
            "TOGGLE_PAID": self.toggle_paid,
            "CREATE_CARD": self.create_card,
            "UPDATE_CARD": self.update_card,
            "DELETE_CARD": self.delete_card,
        }
        for mutation in payload.mutations:
            try:
                handlers[mutation.type](mutation)
            except ValidationError as error:
                self.db.rollback()
                self.conflict(mutation, f"validation failed: {_validation_reason(error)}")
            except HTTPException as error:
                self.db.rollback()
                detail = error.detail if isinstance(error.detail, str) else "; ".join(f"{item.get('field')}: {item.get('issue')}" for item in error.detail)
                self.conflict(mutation, detail)
        synced_at = datetime.now(timezone.utc)
        return SyncBatchResponse(synced_at=synced_at, applied=self.applied, server_changes=server_changes(self.db, self.user, payload.last_sync_timestamp), conflicts=self.conflicts)

    # -- helpers -----------------------------------------------------------------------------------------------------
    def conflict(self, mutation: Mutation, reason: str, server: BaseModel | None = None) -> None:
        self.conflicts.append(SyncConflict(type=mutation.type, id=mutation.id, reason=reason, server=server.model_dump(by_alias=True) if server else None))

    def ok(self, mutation: Mutation, entity_id: str) -> None:
        self.applied.append(SyncApplied(type=mutation.type, id=entity_id))

    @staticmethod
    def _data(mutation: Mutation) -> dict:
        data = dict(mutation.data or {})
        if mutation.id and "id" not in data:
            data["id"] = mutation.id
        return data

    # -- expenses ----------------------------------------------------------------------------------------------------
    def create_expense(self, mutation: Mutation) -> None:
        data = ExpenseCreate.model_validate(self._data(mutation))
        existing = self.db.get(Expense, data.id) if data.id else None
        if existing is not None and existing.user_id == self.user.id and _server_wins(existing.updated_at, mutation.client_updated_at):
            self.conflict(mutation, "server version is newer", ExpenseRead.model_validate(existing))
            return
        expense = expense_service.create_expense(self.db, self.user, data)
        self.ok(mutation, expense.id)

    def update_expense(self, mutation: Mutation) -> None:
        if not mutation.id:
            self.conflict(mutation, "id is required")
            return
        expense = self.db.scalar(expense_service.visible_expenses(self.db, self.user, include_deleted=True).where(Expense.id == mutation.id))
        if expense is None:
            self.conflict(mutation, "expense not found")
            return
        if expense.deleted_at is not None:
            self.conflict(mutation, "expense was deleted on the server", ExpenseRead.model_validate(expense))
            return
        if _server_wins(expense.updated_at, mutation.client_updated_at):
            self.conflict(mutation, "server version is newer", ExpenseRead.model_validate(expense))
            return
        expense_service.patch_expense(self.db, self.user, expense, ExpensePatch.model_validate(mutation.data or {}))
        self.ok(mutation, expense.id)

    def delete_expense(self, mutation: Mutation) -> None:
        if not mutation.id:
            self.conflict(mutation, "id is required")
            return
        expense = self.db.scalar(expense_service.visible_expenses(self.db, self.user, include_deleted=True).where(Expense.id == mutation.id))
        if expense is None:
            self.conflict(mutation, "expense not found")
            return
        if expense.deleted_at is None:
            expense_service.soft_delete_expense(self.db, expense)
        self.ok(mutation, expense.id)

    def toggle_paid(self, mutation: Mutation) -> None:
        if not mutation.id:
            self.conflict(mutation, "id is required")
            return
        expense = self.db.scalar(expense_service.visible_expenses(self.db, self.user).where(Expense.id == mutation.id))
        if expense is None:
            self.conflict(mutation, "expense not found")
            return
        if _server_wins(expense.updated_at, mutation.client_updated_at):
            self.conflict(mutation, "server version is newer", ExpenseRead.model_validate(expense))
            return
        requested = (mutation.data or {}).get("paid")
        expense.paid = bool(requested) if requested is not None else not expense.paid
        self.db.commit()
        self.ok(mutation, expense.id)

    # -- cards -------------------------------------------------------------------------------------------------------
    def create_card(self, mutation: Mutation) -> None:
        data = CardCreate.model_validate(self._data(mutation))
        existing = self.db.get(Card, data.id) if data.id else None
        if existing is not None and existing.user_id == self.user.id and _server_wins(existing.updated_at, mutation.client_updated_at):
            self.conflict(mutation, "server version is newer", CardRead.model_validate(existing))
            return
        card = card_service.create_card(self.db, self.user, data)
        self.ok(mutation, card.id)

    def update_card(self, mutation: Mutation) -> None:
        if not mutation.id:
            self.conflict(mutation, "id is required")
            return
        card = self.db.scalar(select(Card).where(Card.id == mutation.id, Card.user_id == self.user.id))
        if card is None:
            self.conflict(mutation, "card not found")
            return
        if card.deleted_at is not None:
            self.conflict(mutation, "card was deleted on the server", CardRead.model_validate(card))
            return
        if _server_wins(card.updated_at, mutation.client_updated_at):
            self.conflict(mutation, "server version is newer", CardRead.model_validate(card))
            return
        card_service.patch_card(self.db, card, CardPatch.model_validate(mutation.data or {}))
        self.ok(mutation, card.id)

    def delete_card(self, mutation: Mutation) -> None:
        if not mutation.id:
            self.conflict(mutation, "id is required")
            return
        card = self.db.scalar(select(Card).where(Card.id == mutation.id, Card.user_id == self.user.id))
        if card is None:
            self.conflict(mutation, "card not found")
            return
        if card.deleted_at is None:
            card_service.soft_delete_card(self.db, card)
        self.ok(mutation, card.id)


def server_changes(db: Session, user: User, since: datetime | None) -> ServerChanges:
    """Everything that changed after the client's last sync, including soft-deleted rows so devices can drop them."""
    expense_query = expense_service.visible_expenses(db, user, include_deleted=since is not None)
    card_query = select(Card).where(Card.user_id == user.id)
    if since is not None:
        since = ensure_utc(since)
        expense_query = expense_query.where(Expense.updated_at > since)
        card_query = card_query.where(Card.updated_at > since)
    else:
        card_query = card_query.where(Card.deleted_at.is_(None))
    expenses = list(db.scalars(expense_query.order_by(Expense.updated_at.asc())))
    cards = list(db.scalars(card_query.order_by(Card.updated_at.asc())))
    return ServerChanges(expenses=[ExpenseRead.model_validate(item) for item in expenses], cards=[CardRead.model_validate(item) for item in cards])


def process_batch(db: Session, user: User, payload: SyncBatchRequest) -> SyncBatchResponse:
    return BatchProcessor(db, user).run(payload)


def import_backup(db: Session, user: User, payload: BackupPayload) -> ImportResult:
    """Populate the account from the JSON backup generated by the mobile app (idempotent upsert by id)."""
    result = ImportResult(cards_created=0, cards_updated=0, expenses_created=0, expenses_updated=0, warnings=[])
    owned_card_ids: set[str] = set()

    for item in payload.cards:
        card = db.get(Card, item.id)
        if card is not None and card.user_id != user.id:
            result.warnings.append({"type": "card", "id": item.id, "reason": "id belongs to another account; skipped"})
            continue
        values = {
            "holder_name": item.holder_name,
            "brand": item.brand.lower() if item.brand.lower() in ("visa", "mastercard", "elo", "generic") else "generic",
            "type": "Debit" if normalize_card_type(item.type) == "Debit" else "Credit",
            "last_digits": item.last_digits,
            "expiry_date": item.expiry_date,
            "limit": Decimal(str(item.limit)),
            "color_accent": item.color_accent or "#ff453a",
        }
        if card is None:
            db.add(Card(id=item.id, user_id=user.id, created_at=item.created_at or datetime.now(timezone.utc), **values))
            result.cards_created += 1
        else:
            for key, value in values.items():
                setattr(card, key, value)
            card.deleted_at = None
            result.cards_updated += 1
        owned_card_ids.add(item.id)
    db.flush()
    owned_card_ids.update(db.scalars(select(Card.id).where(Card.user_id == user.id, Card.deleted_at.is_(None))))

    for item in payload.expenses:
        expense = db.get(Expense, item.id)
        if expense is not None and expense.user_id != user.id:
            result.warnings.append({"type": "expense", "id": item.id, "reason": "id belongs to another account; skipped"})
            continue
        card_id = item.card_id
        if card_id and card_id not in owned_card_ids:
            result.warnings.append({"type": "expense", "id": item.id, "reason": "card not found; cardId cleared"})
            card_id = None
        values = {
            "description": item.description,
            "amount": Decimal(str(item.amount)).quantize(Decimal("0.01")),
            "person": item.person,
            "date": item.date,
            "tags": item.tags,
            "paid": item.paid,
            "source": item.source or "import",
            "card_id": card_id,
            "recurring": item.recurring,
            "recurring_months": item.recurring_months,
            "recurring_source_id": item.recurring_source_id,
            "skipped_months": item.skipped_months,
        }
        if expense is None:
            db.add(Expense(id=item.id, user_id=user.id, created_at=item.created_at or datetime.now(timezone.utc), **values))
            result.expenses_created += 1
        else:
            for key, value in values.items():
                setattr(expense, key, value)
            expense.deleted_at = None
            result.expenses_updated += 1
    db.commit()
    return result


def export_backup(db: Session, user: User) -> BackupExport:
    cards = card_service.list_cards(db, user, include_archived=True)
    expenses = list(db.scalars(select(Expense).where(Expense.user_id == user.id, Expense.deleted_at.is_(None)).order_by(Expense.date.desc())))
    return BackupExport(
        version=BACKUP_VERSION,
        exported_at=datetime.now(timezone.utc),
        cards=[CardRead.model_validate(item) for item in cards],
        expenses=[ExpenseRead.model_validate(item) for item in expenses],
    )
