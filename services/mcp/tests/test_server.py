import server
import pytest


def test_search_rejects_email_and_phone_like_queries() -> None:
    with pytest.raises(ValueError, match="contact or account"):
        server.search_public_listings("student@example.org")
    with pytest.raises(ValueError, match="contact or account"):
        server.search_public_listings("my number 255 712 345 678")


def test_search_rejects_unbounded_queries_and_limits() -> None:
    with pytest.raises(ValueError, match="between 2 and 120"):
        server.search_public_listings("x")
    with pytest.raises(ValueError, match="between 1 and 25"):
        server.search_public_listings("blue bottle", limit=26)


def test_public_item_projection_drops_private_and_unknown_fields() -> None:
    projected = server._project_public_item(
        {
            "id": "sample-item-001",
            "title": "Blue umbrella",
            "category": "accessories",
            "kind": "found",
            "status": "open",
            "institution_name": "Example University (Demo)",
            "description": "Blue foldable umbrella near the commons.",
            "location": "Student commons",
            "occurred_on": "2025-02-14",
            "contact_details": "+255700000000",
            "private_evidence": "engraving on handle",
            "staff_notes": "Call claimant",
        }
    )
    assert projected is not None
    assert projected["title"] == "Blue umbrella"
    assert projected["approximate_area"] == "Student commons"
    assert "contact_details" not in projected
    assert "private_evidence" not in projected
    assert "staff_notes" not in projected


def test_search_projects_only_safe_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        server,
        "_request_json",
        lambda path, query=None: {
            "data": [
                {
                    "id": "sample-item-001",
                    "title": "Blue umbrella",
                    "description": "A foldable blue umbrella.",
                    "private_evidence": "engraving omitted",
                },
                {"id": "broken-row"},
            ]
        },
    )
    result = server.search_public_listings("blue umbrella", limit=5)
    assert result["status"] == "ok"
    assert result["count"] == 1
    assert result["items"][0]["title"] == "Blue umbrella"
    assert "private_evidence" not in result["items"][0]


def test_listing_id_is_validated_before_request(monkeypatch: pytest.MonkeyPatch) -> None:
    def unexpected_request(*args: object, **kwargs: object) -> None:
        raise AssertionError("invalid id must be rejected before any request")

    monkeypatch.setattr(server, "_request_json", unexpected_request)
    with pytest.raises(ValueError, match="valid public listing"):
        server.get_public_listing("../../private")


def test_institution_projection_returns_public_directory_fields_only() -> None:
    projected = server._project_institution(
        {
            "id": "example-university",
            "name": "Example University (Demo)",
            "region": "Dar es Salaam",
            "staff_email": "private@example.org",
        }
    )
    assert projected == {
        "id": "example-university",
        "name": "Example University (Demo)",
        "region": "Dar es Salaam",
    }
