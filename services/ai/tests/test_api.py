import os

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


BASE_QUERY = {
    "record_id": "q1",
    "category": "phone",
    "description": "black android phone with cracked screen",
    "observed_date": "2025-02-10",
    "location": "Example University library",
}


def record(record_id, *, category="phone", description="black android phone", observed_date="2025-02-11", location="Example University library"):
    return {
        "record_id": record_id,
        "category": category,
        "description": description,
        "observed_date": observed_date,
        "location": location,
    }


def test_health_and_readiness():
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"status": "ready", "ranking": "local_deterministic_v1"}


def test_match_ranks_overlap_with_neutral_versioned_signal():
    response = client.post("/v1/matches", json={
        "query": BASE_QUERY,
        "candidates": [
            record("less-similar", category="bag", description="blue canvas tote", location="Example University cafe"),
            record("more-similar"),
        ],
    })
    assert response.status_code == 200
    result = response.json()
    assert [item["candidate_id"] for item in result["suggestions"]] == ["more-similar", "less-similar"]
    signal = result["suggestions"][0]["signal"]
    assert signal["name"] == "lexical_category_date_location"
    assert signal["version"] == "v1"
    assert signal["interpretation"] == "uncalibrated_assistive_suggestion_only"
    assert 0 <= signal["score"] <= 1
    assert all("Category terms overlap." in result["suggestions"][0]["explanations"] for _ in [0])
    assert "ownership" in result["notice"]


def test_no_candidates_returns_empty_suggestions():
    response = client.post("/v1/matches", json={"query": BASE_QUERY, "candidates": []})
    assert response.status_code == 200
    assert response.json()["suggestions"] == []


def test_missing_observed_date_is_neutral_not_rejected():
    query = {key: value for key, value in BASE_QUERY.items() if key != "observed_date"}
    candidate = {key: value for key, value in record("found-01").items() if key != "observed_date"}
    response = client.post("/v1/matches", json={"query": query, "candidates": [candidate]})
    assert response.status_code == 200
    result = response.json()["suggestions"][0]
    assert result["candidate_id"] == "found-01"
    assert all("date" not in reason.lower() for reason in result["explanations"])


def test_pii_is_rejected_without_echoing_input():
    query = {**BASE_QUERY, "description": "black phone; call me at person@example.test"}
    response = client.post("/v1/matches", json={"query": query, "candidates": []})
    assert response.status_code == 422
    assert response.json() == {"detail": "Request validation failed."}
    assert "person@example.test" not in response.text


def test_invalid_dates_extra_fields_and_candidate_limit_are_rejected_safely():
    bad_date = {**BASE_QUERY, "observed_date": "not-a-date"}
    response = client.post("/v1/matches", json={"query": bad_date, "candidates": []})
    assert response.status_code == 422
    assert "not-a-date" not in response.text

    response = client.post("/v1/matches", json={"query": {**BASE_QUERY, "owner_name": "Synthetic Person"}, "candidates": []})
    assert response.status_code == 422
    assert "Synthetic Person" not in response.text

    response = client.post("/v1/matches", json={"query": BASE_QUERY, "candidates": [record(str(i)) for i in range(51)]})
    assert response.status_code == 422


def test_optional_bearer_token_when_configured(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "unit-test-secret")
    body = {"query": BASE_QUERY, "candidates": []}
    assert client.post("/v1/matches", json=body).status_code == 401
    assert client.post("/v1/matches", json=body, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/v1/matches", json=body, headers={"Authorization": "Bearer unit-test-secret"}).status_code == 200
    monkeypatch.delenv("AI_SERVICE_TOKEN")


def test_oversized_body_rejected():
    response = client.post("/v1/matches", content=b" " * (64 * 1024 + 1), headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body exceeds the 65536-byte limit."}
