from app.schemas.expenses import normalize_tags


def test_normalize_tags_leaves_non_list_values_for_pydantic_validation():
    assert normalize_tags(None) is None
    assert normalize_tags("Food") == "Food"
