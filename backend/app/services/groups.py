from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models.expense import Expense
from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.group import GroupBalance, GroupMemberRead, GroupRead, PersonBalance
from app.services.auth import find_user_by_email

ZERO = Decimal("0")


def serialize_group(group: Group) -> GroupRead:
    members = [
        GroupMemberRead(user_id=member.user_id, name=member.user.name, email=member.user.email, role=member.role, joined_at=member.joined_at)
        for member in sorted(group.members, key=lambda item: (item.role != "owner", item.joined_at))
    ]
    return GroupRead(id=group.id, name=group.name, created_by=group.created_by, created_at=group.created_at, updated_at=group.updated_at, members=members)


def list_groups(db: Session, user: User) -> list[Group]:
    query = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user.id)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .order_by(Group.created_at.asc())
    )
    return list(db.scalars(query))


def get_membership(db: Session, user: User, group_id: str) -> tuple[Group, GroupMember]:
    group = db.scalar(select(Group).where(Group.id == group_id).options(selectinload(Group.members).selectinload(GroupMember.user)))
    membership = next((member for member in group.members if member.user_id == user.id), None) if group else None
    if group is None or membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return group, membership


def require_owner(membership: GroupMember) -> None:
    if membership.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the group owner can do this")


def create_group(db: Session, user: User, name: str) -> Group:
    group = Group(name=name.strip(), created_by=user.id)
    group.members.append(GroupMember(user_id=user.id, role="owner"))
    db.add(group)
    db.commit()
    return get_membership(db, user, group.id)[0]


def rename_group(db: Session, group: Group, name: str) -> Group:
    group.name = name.strip()
    group.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, group: Group) -> None:
    # Shared expenses go back to being personal expenses of whoever created them.
    db.execute(update(Expense).where(Expense.group_id == group.id).values(group_id=None, updated_at=datetime.now(timezone.utc)))
    db.delete(group)
    db.commit()


def add_member(db: Session, group: Group, email: str) -> GroupMember:
    target = find_user_by_email(db, email)
    if target is None or not target.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this e-mail")
    if any(member.user_id == target.id for member in group.members):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this group")
    member = GroupMember(user_id=target.id, role="member")
    group.members.append(member)
    group.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(group)
    return member


def remove_member(db: Session, group: Group, actor: GroupMember, target_user_id: str) -> None:
    target = next((member for member in group.members if member.user_id == target_user_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The owner cannot leave the group; delete it instead")
    if actor.user_id != target_user_id:
        require_owner(actor)
    # Expenses the removed member created inside the group stay with them as personal expenses.
    db.execute(update(Expense).where(Expense.group_id == group.id, Expense.user_id == target_user_id).values(group_id=None, updated_at=datetime.now(timezone.utc)))
    db.delete(target)
    group.updated_at = datetime.now(timezone.utc)
    db.commit()


def group_balance(db: Session, group: Group) -> GroupBalance:
    expenses = list(db.scalars(select(Expense).where(Expense.group_id == group.id, Expense.deleted_at.is_(None))))
    per_person: dict[str, dict] = defaultdict(lambda: {"total": ZERO, "pending": ZERO, "paid": ZERO, "count": 0})
    for item in expenses:
        bucket = per_person[item.person]
        bucket["total"] += item.amount
        bucket["count"] += 1
        bucket["paid" if item.paid else "pending"] += item.amount
    total = sum((item.amount for item in expenses), ZERO)
    paid = sum((item.amount for item in expenses if item.paid), ZERO)
    people = [PersonBalance(person=person, **values) for person, values in sorted(per_person.items(), key=lambda pair: pair[1]["pending"], reverse=True)]
    return GroupBalance(group_id=group.id, total=total, pending=total - paid, paid=paid, per_person=people)
