from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.card import Card
from app.models.expense import Expense
from app.schemas.sync import BackupPayload, Mutation, SyncBatchRequest
from pydantic import ValidationError
from app.schemas.expenses import ExpenseCreate
from app.services import sync as service


def _mutation(kind, *, entity_id=None, data=None, client_updated_at=None):
    return Mutation(type=kind, id=entity_id, data=data, clientUpdatedAt=client_updated_at)


def test_server_wins_only_when_server_timestamp_is_newer():
    server = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    assert service._server_wins(server, server - timedelta(seconds=1)) is True
    assert service._server_wins(server, server) is False
    assert service._server_wins(server, server + timedelta(seconds=1)) is False
    assert service._server_wins(server, None) is False


def test_server_wins_compares_equivalent_timezones_as_utc():
    server = datetime(2026, 9, 10, 15, tzinfo=timezone(timedelta(hours=3)))
    client = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    assert service._server_wins(server, client) is False



def test_validation_reason_formats_schema_error_fields():
    try:
        ExpenseCreate.model_validate({"description": "Bad", "amount": -1, "person": "Ana", "date": "2026-09-10"})
    except ValidationError as error:
        reason = service._validation_reason(error)
    else:  # pragma: no cover - a negative amount must fail schema validation
        raise AssertionError("Expected validation to fail")
    assert reason.startswith("amount: Input should be greater than 0")

def test_batch_processor_data_uses_mutation_id_when_payload_has_no_id(user, db_session):
    processor = service.BatchProcessor(db_session, user)
    mutation = _mutation("CREATE_EXPENSE", entity_id="client-id", data={"description": "Lunch"})
    assert processor._data(mutation) == {"description": "Lunch", "id": "client-id"}


def test_batch_processor_data_does_not_override_payload_id(user, db_session):
    processor = service.BatchProcessor(db_session, user)
    mutation = _mutation("CREATE_EXPENSE", entity_id="mutation-id", data={"id": "payload-id"})
    assert processor._data(mutation) == {"id": "payload-id"}


def test_process_batch_applies_create_expense_using_mutation_id(user, db_session):
    mutation = _mutation(
        "CREATE_EXPENSE",
        entity_id="offline-expense-id",
        data={"description": "Lunch", "amount": 25, "person": "Ana", "date": "2026-09-10"},
    )
    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))
    assert [(item.type, item.id) for item in result.applied] == [("CREATE_EXPENSE", "offline-expense-id")]
    assert result.conflicts == []
    assert result.server_changes.expenses[0].id == "offline-expense-id"


def test_process_batch_reports_validation_conflict_and_continues(user, db_session):
    invalid = _mutation("CREATE_EXPENSE", data={"description": "Invalid", "amount": -2, "person": "Ana", "date": "2026-09-10"})
    valid = _mutation("CREATE_EXPENSE", entity_id="valid-id", data={"description": "Valid", "amount": 2, "person": "Ana", "date": "2026-09-10"})
    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[invalid, valid]))
    assert [item.id for item in result.applied] == ["valid-id"]
    assert len(result.conflicts) == 1
    assert result.conflicts[0].reason.startswith("validation failed: amount:")


def test_process_batch_reports_missing_id_for_update_and_delete(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("UPDATE_EXPENSE", data={"paid": True}), _mutation("DELETE_CARD")]),
    )
    assert [item.reason for item in result.conflicts] == ["id is required", "id is required"]


def test_process_batch_explicit_toggle_paid_value_is_respected(make_expense, user, db_session):
    expense = make_expense(user, paid=True)
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("TOGGLE_PAID", entity_id=expense.id, data={"paid": False})]),
    )
    db_session.refresh(expense)
    assert result.applied[0].id == expense.id
    assert expense.paid is False


def test_process_batch_toggle_paid_without_value_flips_boolean(make_expense, user, db_session):
    expense = make_expense(user, paid=False)
    service.process_batch(db_session, user, SyncBatchRequest(mutations=[_mutation("TOGGLE_PAID", entity_id=expense.id)]))
    db_session.refresh(expense)
    assert expense.paid is True


def test_process_batch_delete_expense_is_idempotent(make_expense, user, db_session):
    deleted = make_expense(user, deleted_at=datetime.now(timezone.utc))
    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[_mutation("DELETE_EXPENSE", entity_id=deleted.id)]))
    assert result.applied[0].id == deleted.id
    assert result.conflicts == []


def test_process_batch_cannot_update_deleted_expense(make_expense, user, db_session):
    deleted = make_expense(user, deleted_at=datetime.now(timezone.utc))
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("UPDATE_EXPENSE", entity_id=deleted.id, data={"description": "Ghost"})]),
    )
    assert result.conflicts[0].reason == "expense was deleted on the server"


def test_process_batch_creates_updates_and_deletes_cards(make_card, make_expense, user, db_session):
    card = make_card(user, card_id="sync-card")
    expense = make_expense(user, card_id=card.id)
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(
            mutations=[
                _mutation("UPDATE_CARD", entity_id=card.id, data={"limit": 600}),
                _mutation("DELETE_CARD", entity_id=card.id),
            ]
        ),
    )
    db_session.refresh(card)
    db_session.refresh(expense)
    assert [item.type for item in result.applied] == ["UPDATE_CARD", "DELETE_CARD"]
    assert card.limit == Decimal("600")
    assert card.deleted_at is not None
    assert expense.card_id is None


def test_process_batch_cannot_update_deleted_card(make_card, user, db_session):
    card = make_card(user, deleted_at=datetime.now(timezone.utc))
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("UPDATE_CARD", entity_id=card.id, data={"limit": 700})]),
    )
    assert result.conflicts[0].reason == "card was deleted on the server"


def test_server_changes_initial_sync_excludes_deleted_cards(make_card, make_expense, user, db_session):
    active = make_card(user)
    make_card(user, deleted_at=datetime.now(timezone.utc))
    expense = make_expense(user)
    changes = service.server_changes(db_session, user, since=None)
    assert [item.id for item in changes.cards] == [active.id]
    assert [item.id for item in changes.expenses] == [expense.id]


def test_server_changes_delta_includes_soft_deleted_records(make_card, make_expense, user, db_session):
    old = datetime(2026, 9, 1, tzinfo=timezone.utc)
    card = make_card(user)
    expense = make_expense(user, updated_at=datetime(2026, 9, 2, tzinfo=timezone.utc))
    card.deleted_at = datetime(2026, 9, 3, tzinfo=timezone.utc)
    expense.deleted_at = datetime(2026, 9, 3, tzinfo=timezone.utc)
    expense.updated_at = datetime(2026, 9, 3, tzinfo=timezone.utc)
    db_session.commit()
    changes = service.server_changes(db_session, user, since=old)
    assert [item.id for item in changes.cards] == [card.id]
    assert [item.id for item in changes.expenses] == [expense.id]
    assert changes.cards[0].deleted_at is not None
    assert changes.expenses[0].deleted_at is not None


def test_import_backup_creates_card_and_expense_and_clears_unknown_card(user, db_session):
    payload = BackupPayload.model_validate(
        {
            "version": "1.0.0",
            "cards": [
                {"id": "backup-card", "holderName": "Backup", "brand": "VISA", "type": "Credit", "lastDigits": "1234", "expiryDate": "12/30", "limit": 2000}
            ],
            "expenses": [
                {"id": "backup-expense", "description": "Groceries", "amount": 10.1, "person": "Ana", "date": "2026-09-10", "cardId": "missing-card"}
            ],
        }
    )
    result = service.import_backup(db_session, user, payload)
    card = db_session.get(Card, "backup-card")
    expense = db_session.get(Expense, "backup-expense")
    assert result.cards_created == 1
    assert result.expenses_created == 1
    assert result.warnings == [{"type": "expense", "id": "backup-expense", "reason": "card not found; cardId cleared"}]
    assert card.brand == "visa"
    assert expense.card_id is None
    assert expense.amount == Decimal("10.10")
    assert expense.source == "import"


def test_import_backup_is_idempotent_and_restores_soft_deleted_items(make_card, make_expense, user, db_session):
    deleted_at = datetime.now(timezone.utc)
    card = make_card(user, card_id="restore-card", deleted_at=deleted_at)
    expense = make_expense(user, expense_id="restore-expense", deleted_at=deleted_at)
    payload = BackupPayload.model_validate(
        {
            "cards": [{"id": card.id, "holderName": "Updated Card", "lastDigits": "2222", "expiryDate": "11/30", "limit": 500}],
            "expenses": [{"id": expense.id, "description": "Updated Expense", "amount": 50, "person": "Ana", "date": "2026-09-12"}],
        }
    )
    result = service.import_backup(db_session, user, payload)
    db_session.refresh(card)
    db_session.refresh(expense)
    assert result.cards_updated == 1
    assert result.expenses_updated == 1
    assert card.deleted_at is None
    assert expense.deleted_at is None
    assert card.holder_name == "Updated Card"
    assert expense.description == "Updated Expense"


def test_import_backup_skips_ids_owned_by_another_user(make_card, make_expense, user, other_user, db_session):
    foreign_card = make_card(other_user, card_id="foreign-card")
    foreign_expense = make_expense(other_user, expense_id="foreign-expense")
    payload = BackupPayload.model_validate(
        {
            "cards": [{"id": foreign_card.id, "holderName": "Spoofed", "lastDigits": "1234", "expiryDate": "12/30", "limit": 10}],
            "expenses": [{"id": foreign_expense.id, "description": "Spoofed", "amount": 99, "person": "X", "date": "2026-09-10"}],
        }
    )
    result = service.import_backup(db_session, user, payload)
    db_session.refresh(foreign_card)
    db_session.refresh(foreign_expense)
    assert result.cards_created == result.cards_updated == 0
    assert result.expenses_created == result.expenses_updated == 0
    assert {item["type"] for item in result.warnings} == {"card", "expense"}
    assert foreign_card.holder_name == "MAIN CARD"
    assert foreign_expense.description == "Groceries"


def test_export_backup_includes_archived_but_not_deleted_cards(make_card, make_expense, user, other_user, db_session):
    active = make_card(user)
    archived = make_card(user, is_archived=True)
    make_card(user, deleted_at=datetime.now(timezone.utc))
    own_expense = make_expense(user)
    make_expense(user, deleted_at=datetime.now(timezone.utc))
    make_expense(other_user)
    exported = service.export_backup(db_session, user)
    assert exported.version == service.BACKUP_VERSION
    assert {item.id for item in exported.cards} == {active.id, archived.id}
    assert [item.id for item in exported.expenses] == [own_expense.id]
    assert exported.exported_at.tzinfo is not None

# Additional unit tests for conflict and error paths in the batch processor.


def test_process_batch_converts_http_exception_string_to_conflict(user, db_session, monkeypatch):
    def reject_create(*args, **kwargs):
        raise HTTPException(status_code=400, detail="expense creation rejected")

    monkeypatch.setattr(service.expense_service, "create_expense", reject_create)
    mutation = _mutation(
        "CREATE_EXPENSE",
        entity_id="rejected-expense",
        data={"description": "Lunch", "amount": 20, "person": "Ana", "date": "2026-09-10"},
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    assert result.applied == []
    assert result.conflicts[0].reason == "expense creation rejected"


@pytest.mark.parametrize(
    ("detail", "expected_reason"),
    [
        ([{"field": "amount", "issue": "must be positive"}], "amount: must be positive"),
        (
            [
                {"field": "amount", "issue": "must be positive"},
                {"field": "date", "issue": "is required"},
            ],
            "amount: must be positive; date: is required",
        ),
    ],
)
def test_process_batch_formats_http_exception_field_details(
    user, db_session, monkeypatch, detail, expected_reason
):
    def reject_create(*args, **kwargs):
        raise HTTPException(status_code=400, detail=detail)

    monkeypatch.setattr(service.expense_service, "create_expense", reject_create)
    mutation = _mutation(
        "CREATE_EXPENSE",
        entity_id="rejected-expense",
        data={"description": "Lunch", "amount": 20, "person": "Ana", "date": "2026-09-10"},
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    assert result.applied == []
    assert result.conflicts[0].reason == expected_reason


def test_process_batch_rejects_create_expense_when_server_version_is_newer(
    make_expense, user, db_session
):
    server_version = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    existing = make_expense(user, expense_id="existing-expense", updated_at=server_version)
    mutation = _mutation(
        "CREATE_EXPENSE",
        entity_id=existing.id,
        data={"description": "Client version", "amount": 99, "person": "Ana", "date": "2026-09-10"},
        client_updated_at=server_version - timedelta(minutes=1),
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    db_session.refresh(existing)
    assert result.applied == []
    assert result.conflicts[0].reason == "server version is newer"
    assert result.conflicts[0].server is not None
    assert existing.description == "Groceries"


def test_process_batch_reports_missing_expense_on_update(user, db_session):
    mutation = _mutation("UPDATE_EXPENSE", entity_id="missing-expense", data={"paid": True})

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    assert result.conflicts[0].reason == "expense not found"


def test_process_batch_rejects_stale_expense_update(make_expense, user, db_session):
    server_version = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    expense = make_expense(user, updated_at=server_version)
    mutation = _mutation(
        "UPDATE_EXPENSE",
        entity_id=expense.id,
        data={"description": "Stale client update"},
        client_updated_at=server_version - timedelta(minutes=1),
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    db_session.refresh(expense)
    assert result.conflicts[0].reason == "server version is newer"
    assert result.conflicts[0].server is not None
    assert expense.description == "Groceries"


def test_process_batch_applies_expense_update(make_expense, user, db_session):
    expense = make_expense(user)
    mutation = _mutation(
        "UPDATE_EXPENSE",
        entity_id=expense.id,
        data={"description": "Updated groceries"},
        client_updated_at=datetime(2030, 9, 20, tzinfo=timezone.utc),
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    db_session.refresh(expense)
    assert result.applied[0].id == expense.id
    assert result.conflicts == []
    assert expense.description == "Updated groceries"


def test_process_batch_reports_missing_expense_on_delete(user, db_session):
    mutation = _mutation("DELETE_EXPENSE", entity_id="missing-expense")

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    assert result.conflicts[0].reason == "expense not found"


def test_process_batch_soft_deletes_active_expense(make_expense, user, db_session):
    expense = make_expense(user)

    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("DELETE_EXPENSE", entity_id=expense.id)]),
    )

    db_session.refresh(expense)
    assert result.applied[0].id == expense.id
    assert result.conflicts == []
    assert expense.deleted_at is not None


def test_process_batch_reports_missing_id_for_toggle_paid(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("TOGGLE_PAID")]),
    )

    assert result.conflicts[0].reason == "id is required"


def test_process_batch_reports_missing_expense_for_toggle_paid(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("TOGGLE_PAID", entity_id="missing-expense")]),
    )

    assert result.conflicts[0].reason == "expense not found"


def test_process_batch_rejects_stale_toggle_paid(make_expense, user, db_session):
    server_version = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    expense = make_expense(user, paid=False, updated_at=server_version)
    mutation = _mutation(
        "TOGGLE_PAID",
        entity_id=expense.id,
        data={"paid": True},
        client_updated_at=server_version - timedelta(minutes=1),
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    db_session.refresh(expense)
    assert result.conflicts[0].reason == "server version is newer"
    assert result.conflicts[0].server is not None
    assert expense.paid is False


def test_process_batch_creates_card(user, db_session):
    mutation = _mutation(
        "CREATE_CARD",
        entity_id="new-sync-card",
        data={
            "holderName": "New Card",
            "brand": "visa",
            "type": "Credit",
            "lastDigits": "1234",
            "expiryDate": "12/30",
            "limit": 1500,
        },
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    created = db_session.get(Card, "new-sync-card")
    assert result.applied[0].id == "new-sync-card"
    assert result.conflicts == []
    assert created is not None
    assert created.holder_name == "New Card"


def test_process_batch_rejects_create_card_when_server_version_is_newer(
    make_card, user, db_session
):
    server_version = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    existing = make_card(user, card_id="existing-sync-card")
    existing.updated_at = server_version
    db_session.commit()
    mutation = _mutation(
        "CREATE_CARD",
        entity_id=existing.id,
        data={
            "holderName": "Client Card",
            "brand": "mastercard",
            "type": "Credit",
            "lastDigits": "5678",
            "expiryDate": "11/30",
            "limit": 2500,
        },
        client_updated_at=server_version - timedelta(minutes=1),
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    db_session.refresh(existing)
    assert result.applied == []
    assert result.conflicts[0].reason == "server version is newer"
    assert result.conflicts[0].server is not None
    assert existing.holder_name == "MAIN CARD"


def test_process_batch_reports_missing_id_for_update_card(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("UPDATE_CARD", data={"limit": 500})]),
    )

    assert result.conflicts[0].reason == "id is required"


def test_process_batch_reports_missing_card_on_update(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(
            mutations=[_mutation("UPDATE_CARD", entity_id="missing-card", data={"limit": 500})]
        ),
    )

    assert result.conflicts[0].reason == "card not found"


def test_process_batch_rejects_stale_card_update(make_card, user, db_session):
    server_version = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
    card = make_card(user)
    card.updated_at = server_version
    db_session.commit()
    mutation = _mutation(
        "UPDATE_CARD",
        entity_id=card.id,
        data={"limit": 2000},
        client_updated_at=server_version - timedelta(minutes=1),
    )

    result = service.process_batch(db_session, user, SyncBatchRequest(mutations=[mutation]))

    db_session.refresh(card)
    assert result.conflicts[0].reason == "server version is newer"
    assert result.conflicts[0].server is not None
    assert card.limit == Decimal("1000.00")


def test_process_batch_reports_missing_card_on_delete(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("DELETE_CARD", entity_id="missing-card")]),
    )

    assert result.conflicts[0].reason == "card not found"


def test_process_batch_deleting_already_deleted_card_is_idempotent(
    make_card, user, db_session
):
    deleted_at = datetime.now(timezone.utc)
    card = make_card(user, deleted_at=deleted_at)

    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("DELETE_CARD", entity_id=card.id)]),
    )

    db_session.refresh(card)
    assert result.applied[0].id == card.id
    assert result.conflicts == []
    assert card.deleted_at is not None


def test_process_batch_reports_missing_id_for_delete_expense(user, db_session):
    result = service.process_batch(
        db_session,
        user,
        SyncBatchRequest(mutations=[_mutation("DELETE_EXPENSE")]),
    )

    assert result.conflicts[0].reason == "id is required"
