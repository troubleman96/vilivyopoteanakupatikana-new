import os
import threading

import numpy as np
import pytest

from fastapi.testclient import TestClient

from embeddinggemma import EmbeddingGemmaRanker
from main import ItemRecord, app

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
    assert client.get("/readyz").json() == {"status": "ready", "ranking": "hybrid_lexical_category_date_location_v2"}


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
    assert signal["name"] == "hybrid_lexical_category_date_location"
    assert signal["version"] == "v2"
    assert signal["interpretation"] == "uncalibrated_assistive_suggestion_only"
    assert 0 <= signal["score"] <= 1
    assert result["ranking"] == "hybrid_lexical_category_date_location_v2"
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


def test_empty_observed_date_from_go_api_is_treated_as_missing():
    query = {**BASE_QUERY, "observed_date": ""}
    candidate = {**record("found-02"), "observed_date": ""}
    response = client.post("/v1/matches", json={"query": query, "candidates": [candidate]})
    assert response.status_code == 200
    assert all("date" not in reason.lower() for reason in response.json()["suggestions"][0]["explanations"])


def test_embeddinggemma_ranker_uses_asymmetric_retrieval_prompts():
    class FakeModel:
        def __init__(self):
            self.prompts = []

        def encode(self, texts, *, prompt_name, **kwargs):
            self.prompts.append((texts, prompt_name, kwargs))
            if isinstance(texts, list):
                return np.array([[1.0, 0.0], [0.0, 1.0]])
            return np.array([1.0, 0.0])

    ranker = EmbeddingGemmaRanker.__new__(EmbeddingGemmaRanker)
    ranker.model = FakeModel()
    ranker.batch_size = 16
    ranker._encode_lock = threading.Lock()
    scores = ranker.similarities(
        ItemRecord.model_validate(BASE_QUERY),
        [ItemRecord.model_validate(record("related")), ItemRecord.model_validate(record("other"))],
    )

    assert scores == [1.0, 0.0]
    assert [prompt[1] for prompt in ranker.model.prompts] == ["SearchQuery", "Document"]
    assert ranker.model.prompts[0][2]["normalize_embeddings"] is True
    assert len(ranker.model.prompts[1][0]) == 2


def test_configured_embeddinggemma_ranker_controls_order_and_signal(monkeypatch):
    class FakeRanker:
        def similarities(self, query, candidates):
            return [0.1, 0.9]

    monkeypatch.setattr(app.state, "embeddinggemma_ranker", FakeRanker())
    response = client.post("/v1/matches", json={
        "query": BASE_QUERY,
        "candidates": [record("first"), record("second", category="bag", description="blue canvas tote", location="Example University cafe")],
    })

    assert response.status_code == 200
    result = response.json()["suggestions"]
    assert [item["candidate_id"] for item in result] == ["second", "first"]
    assert response.json()["ranking"] == "embeddinggemma2_hybrid_lexical_metadata_v2"
    assert result[0]["signal"]["name"] == "embeddinggemma2_hybrid_lexical_metadata"
    assert result[0]["signal"]["interpretation"] == "uncalibrated_assistive_suggestion_only"
    assert "Semantic text similarity contributed to this shortlist." in result[0]["explanations"]


def test_shortlist_is_limited_to_five_with_contiguous_ranks():
    response = client.post(
        "/v1/matches",
        json={"query": BASE_QUERY, "candidates": [record(f"candidate-{index:02d}") for index in range(12)]},
    )
    assert response.status_code == 200
    suggestions = response.json()["suggestions"]
    assert len(suggestions) == 5
    assert [item["rank"] for item in suggestions] == [1, 2, 3, 4, 5]


def test_character_overlap_retrieves_simple_typos_in_deterministic_fallback():
    response = client.post(
        "/v1/matches",
        json={
            "query": {**BASE_QUERY, "description": "black android phone with cracked screeen"},
            "candidates": [
                record("typo-near", description="black android phone with cracked screen"),
                record("unrelated", category="bag", description="blue canvas tote", location="Example University cafe"),
            ],
        },
    )
    assert response.status_code == 200
    assert response.json()["suggestions"][0]["candidate_id"] == "typo-near"


def test_one_thousand_candidates_are_accepted_and_return_only_five():
    response = client.post(
        "/v1/matches",
        json={"query": BASE_QUERY, "candidates": [record(f"candidate-{index:04d}") for index in range(1000)]},
    )
    assert response.status_code == 200
    assert len(response.json()["suggestions"]) == 5


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

    response = client.post("/v1/matches", json={"query": BASE_QUERY, "candidates": [record(str(i)) for i in range(1201)]})
    assert response.status_code == 422


def test_optional_bearer_token_when_configured(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "unit-test-secret")
    body = {"query": BASE_QUERY, "candidates": []}
    assert client.post("/v1/matches", json=body).status_code == 401
    assert client.post("/v1/matches", json=body, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/v1/matches", json=body, headers={"Authorization": "Bearer unit-test-secret"}).status_code == 200
    monkeypatch.delenv("AI_SERVICE_TOKEN")


def test_mounted_bearer_token_and_required_secret_fail_closed(monkeypatch, tmp_path):
    token_file = tmp_path / "ai-token"
    token_file.write_text("synthetic-mounted-token\n", encoding="utf-8")
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    monkeypatch.setenv("AI_SERVICE_TOKEN_FILE", str(token_file))
    monkeypatch.setenv("AI_SERVICE_TOKEN_REQUIRED", "true")
    body = {"query": BASE_QUERY, "candidates": []}
    assert client.post("/v1/matches", json=body).status_code == 401
    assert client.post("/v1/matches", json=body, headers={"Authorization": "Bearer synthetic-mounted-token"}).status_code == 200

    monkeypatch.setenv("AI_SERVICE_TOKEN_FILE", str(tmp_path / "missing-token"))
    response = client.post("/v1/matches", json=body, headers={"Authorization": "Bearer synthetic-mounted-token"})
    assert response.status_code == 503
    assert "synthetic-mounted-token" not in response.text


def test_oversized_body_rejected():
    response = client.post("/v1/matches", content=b" " * (1024 * 1024 + 1), headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body exceeds the 1048576-byte limit."}


def test_required_model_fails_startup_without_local_checkpoint(monkeypatch):
    monkeypatch.setenv("EMBEDDINGGEMMA_REQUIRED", "true")
    monkeypatch.delenv("EMBEDDINGGEMMA_MODEL_PATH", raising=False)
    with pytest.raises(RuntimeError, match="EmbeddingGemma is required"):
        with TestClient(app):
            pass
