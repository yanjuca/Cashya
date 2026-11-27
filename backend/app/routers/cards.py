from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.card import Card
from app.models.user import User
from app.schemas.card import CardCreate, CardPatch, CardRead, CardUpdate
from app.services.cards import card_summary, create_card, get_owned_card, list_cards, patch_card, replace_card, soft_delete_card
from app.services.email_dispatch import send_first_card_nudge

router = APIRouter()


@router.get("", summary="List the user's cards")
def get_cards(
    include_archived: bool = Query(default=False, alias="includeArchived"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return envelope([CardRead.model_validate(card) for card in list_cards(db, user, include_archived=include_archived)])


@router.post("", status_code=status.HTTP_201_CREATED, summary="Register a new card (client UUID accepted)")
def add_card(
    data: CardCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    existing_card = db.scalar(
        select(Card.id)
        .where(Card.user_id == user.id, Card.deleted_at.is_(None))
        .limit(1)
    )
    card = create_card(db, user, data)
    if existing_card is None:
        background_tasks.add_task(send_first_card_nudge, user.id)
    return envelope(CardRead.model_validate(card), "Card created successfully")


@router.get("/{card_id}", summary="Card details")
def get_card(card_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(CardRead.model_validate(get_owned_card(db, user, card_id)))


@router.get("/{card_id}/summary", summary="Limit, spent, pending, paid and available amounts for the wallet screen")
def get_card_summary(
    card_id: str,
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    card = get_owned_card(db, user, card_id)
    return envelope(card_summary(db, card, year, month))


@router.put("/{card_id}", summary="Replace all card fields")
def put_card(card_id: str, data: CardUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    card = get_owned_card(db, user, card_id)
    return envelope(CardRead.model_validate(replace_card(db, card, data)))


@router.patch("/{card_id}", summary="Partially update a card (limit, nickname, archive...)")
def edit_card(card_id: str, data: CardPatch, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    card = get_owned_card(db, user, card_id)
    return envelope(CardRead.model_validate(patch_card(db, card, data)))


@router.delete("/{card_id}", summary="Soft delete the card; linked expenses keep existing with cardId = null")
def remove_card(card_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    card = get_owned_card(db, user, card_id)
    detached = soft_delete_card(db, card)
    return envelope({"id": card.id, "detachedExpenses": detached, "deletedAt": card.deleted_at}, "Card deleted successfully")
