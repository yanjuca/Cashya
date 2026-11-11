from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.group import Group
from app.services import groups as service


def test_serialize_group_places_owner_before_members(make_group, user, other_user):
    group = make_group(user, members=(other_user,))
    serialized = service.serialize_group(group)
    assert serialized.name == "Shared Group"
    assert [member.role for member in serialized.members] == ["owner", "member"]
    assert [member.email for member in serialized.members] == [user.email, other_user.email]


def test_list_groups_returns_only_groups_user_belongs_to(make_group, user, other_user, db_session):
    owned_group = make_group(user, name="Owned")
    make_group(other_user, name="Other")
    assert [group.id for group in service.list_groups(db_session, user)] == [owned_group.id]


def test_get_membership_returns_group_and_member_role(make_group, user, other_user, db_session):
    group = make_group(user, members=(other_user,))
    found_group, membership = service.get_membership(db_session, other_user, group.id)
    assert found_group.id == group.id
    assert membership.role == "member"


def test_get_membership_hides_missing_group_and_non_member(make_group, user, other_user, db_session):
    group = make_group(user)
    for group_id in (group.id, "not-found"):
        with pytest.raises(HTTPException) as error:
            service.get_membership(db_session, other_user, group_id)
        assert error.value.status_code == 404


def test_require_owner_allows_owner(make_group, user, db_session):
    group = make_group(user)
    membership = next(item for item in group.members if item.user_id == user.id)
    assert service.require_owner(membership) is None


def test_require_owner_rejects_regular_member(make_group, user, other_user):
    group = make_group(user, members=(other_user,))
    member = next(item for item in group.members if item.user_id == other_user.id)
    with pytest.raises(HTTPException) as error:
        service.require_owner(member)
    assert error.value.status_code == 403


def test_create_group_trims_name_and_assigns_owner(user, db_session):
    group = service.create_group(db_session, user, "  Apartment  ")
    assert group.name == "Apartment"
    assert group.created_by == user.id
    assert len(group.members) == 1
    assert group.members[0].role == "owner"


def test_rename_group_trims_name(make_group, user, db_session):
    group = make_group(user)
    renamed = service.rename_group(db_session, group, "  New name  ")
    assert renamed.name == "New name"
    assert renamed.updated_at is not None


def test_delete_group_detaches_expenses_instead_of_deleting_them(make_group, make_expense, user, db_session):
    group = make_group(user)
    expense = make_expense(user, group_id=group.id)
    service.delete_group(db_session, group)
    db_session.refresh(expense)
    assert expense.group_id is None
    assert db_session.get(Group, group.id) is None


def test_add_member_creates_regular_membership(make_group, user, other_user, db_session):
    group = make_group(user)
    member = service.add_member(db_session, group, other_user.email)
    assert member.user_id == other_user.id
    assert member.role == "member"
    assert {item.user_id for item in group.members} == {user.id, other_user.id}


def test_add_member_rejects_unknown_email(make_group, user, db_session):
    group = make_group(user)
    with pytest.raises(HTTPException) as error:
        service.add_member(db_session, group, "missing@example.com")
    assert error.value.status_code == 404


def test_add_member_rejects_inactive_user(make_group, user, make_user, db_session):
    inactive = make_user(email="inactive@example.com", is_active=False)
    group = make_group(user)
    with pytest.raises(HTTPException) as error:
        service.add_member(db_session, group, inactive.email)
    assert error.value.status_code == 404


def test_add_member_rejects_duplicate_membership(make_group, user, other_user, db_session):
    group = make_group(user, members=(other_user,))
    with pytest.raises(HTTPException) as error:
        service.add_member(db_session, group, other_user.email)
    assert error.value.status_code == 409


def test_remove_member_allows_member_to_leave_and_detaches_their_expenses(make_group, make_expense, user, other_user, db_session):
    group = make_group(user, members=(other_user,))
    member_membership = next(item for item in group.members if item.user_id == other_user.id)
    member_expense = make_expense(other_user, group_id=group.id)
    owner_expense = make_expense(user, group_id=group.id)
    service.remove_member(db_session, group, member_membership, other_user.id)
    db_session.refresh(member_expense)
    db_session.refresh(owner_expense)
    assert member_expense.group_id is None
    assert owner_expense.group_id == group.id
    db_session.expire(group, ["members"])
    assert {item.user_id for item in group.members} == {user.id}


def test_remove_member_allows_owner_to_remove_regular_member(make_group, user, other_user, db_session):
    group = make_group(user, members=(other_user,))
    owner_membership = next(item for item in group.members if item.user_id == user.id)
    service.remove_member(db_session, group, owner_membership, other_user.id)
    db_session.expire(group, ["members"])
    assert all(item.user_id != other_user.id for item in group.members)


def test_remove_member_rejects_missing_member(make_group, user, db_session):
    group = make_group(user)
    owner = group.members[0]
    with pytest.raises(HTTPException) as error:
        service.remove_member(db_session, group, owner, "no-such-user")
    assert error.value.status_code == 404


def test_remove_member_does_not_allow_owner_to_leave(make_group, user, db_session):
    group = make_group(user)
    owner = group.members[0]
    with pytest.raises(HTTPException) as error:
        service.remove_member(db_session, group, owner, user.id)
    assert error.value.status_code == 400


def test_remove_member_prevents_non_owner_removing_another_member(make_group, make_user, user, other_user, db_session):
    third_user = make_user(email="third@example.com")
    group = make_group(user, members=(other_user, third_user))
    actor = next(item for item in group.members if item.user_id == other_user.id)
    with pytest.raises(HTTPException) as error:
        service.remove_member(db_session, group, actor, third_user.id)
    assert error.value.status_code == 403


def test_group_balance_totals_by_person_and_ignores_deleted_expenses(make_group, make_expense, user, other_user, db_session):
    group = make_group(user, members=(other_user,))
    make_expense(user, group_id=group.id, person="Ana", amount="100", paid=False)
    make_expense(other_user, group_id=group.id, person="Bruno", amount="50", paid=True)
    make_expense(user, group_id=group.id, person="Ana", amount="25", deleted_at=datetime.now(timezone.utc))
    balance = service.group_balance(db_session, group)
    assert balance.total == Decimal("150")
    assert balance.pending == Decimal("100")
    assert balance.paid == Decimal("50")
    assert [person.person for person in balance.per_person] == ["Ana", "Bruno"]
    assert balance.per_person[0].count == 1
    assert balance.per_person[1].paid == Decimal("50")


def test_group_balance_empty_group_returns_zeroes(make_group, user, db_session):
    group = make_group(user)
    balance = service.group_balance(db_session, group)
    assert balance.total == Decimal("0")
    assert balance.pending == Decimal("0")
    assert balance.paid == Decimal("0")
    assert balance.per_person == []
