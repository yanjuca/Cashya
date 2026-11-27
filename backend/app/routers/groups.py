from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.serialization import envelope
from app.models.user import User
from app.schemas.expenses import ExpenseRead
from app.schemas.group import GroupCreate, GroupMemberAdd, GroupUpdate
from app.services.expenses import apply_filters, paginate, visible_expenses
from app.services.groups import add_member, create_group, delete_group, get_membership, group_balance, list_groups, remove_member, rename_group, require_owner, serialize_group

router = APIRouter()


@router.get("", summary="Groups the user belongs to")
def get_groups(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope([serialize_group(group) for group in list_groups(db, user)])


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a group; the creator becomes owner")
def post_group(data: GroupCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return envelope(serialize_group(create_group(db, user, data.name)), "Group created successfully")


@router.get("/{group_id}", summary="Group details and members")
def get_group(group_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    group, _ = get_membership(db, user, group_id)
    return envelope(serialize_group(group))


@router.patch("/{group_id}", summary="Rename the group (owner only)")
def patch_group(group_id: str, data: GroupUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    group, membership = get_membership(db, user, group_id)
    require_owner(membership)
    rename_group(db, group, data.name)
    return envelope(serialize_group(get_membership(db, user, group_id)[0]))


@router.delete("/{group_id}", summary="Delete the group (owner only); its expenses become personal again")
def remove_group(group_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    group, membership = get_membership(db, user, group_id)
    require_owner(membership)
    delete_group(db, group)
    return envelope(message="Group deleted successfully")


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED, summary="Add a member by e-mail (owner only)")
def post_member(group_id: str, data: GroupMemberAdd, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    group, membership = get_membership(db, user, group_id)
    require_owner(membership)
    add_member(db, group, data.email)
    return envelope(serialize_group(get_membership(db, user, group_id)[0]), "Member added")


@router.delete("/{group_id}/members/{member_user_id}", summary="Remove a member (owner) or leave the group (self)")
def delete_member(group_id: str, member_user_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    group, membership = get_membership(db, user, group_id)
    remove_member(db, group, membership, member_user_id)
    return envelope(message="Member removed")


@router.get("/{group_id}/expenses", summary="Expenses shared in the group")
def get_group_expenses(
    group_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    status_filter: str = Query(default="all", alias="status", pattern="^(all|pending|paid)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    get_membership(db, user, group_id)
    query = apply_filters(visible_expenses(db, user), group_id=group_id, status_filter=status_filter)
    items, total = paginate(db, query, page, limit)
    return envelope({"items": [ExpenseRead.model_validate(item) for item in items], "pagination": {"page": page, "limit": limit, "total": total}})


@router.get("/{group_id}/balance", summary="Who owes what: totals per person inside the group")
def get_group_balance(group_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    group, _ = get_membership(db, user, group_id)
    return envelope(group_balance(db, group))
