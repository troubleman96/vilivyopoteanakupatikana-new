# Internal AI matching suggestions

Private FastAPI service for **ranking possible lost-and-found record matches**. When `EMBEDDINGGEMMA_MODEL_PATH` points to a local EmbeddingGemma 2 checkpoint, it uses semantic similarity with category/date/location signals. If unset, it uses the deterministic lexical/category/date/location fallback. A configured but invalid path fails startup; weights are never downloaded.

The model is loaded once at startup, uses the checkpoint's asymmetric `SearchQuery` and `Document` prompts, loads text weights only, and keeps request embeddings in memory only for ranking. No vector database, persistent embedding store, external model call, image inspection, or ownership decision is involved.

## API

- `GET /healthz` — process liveness.
- `GET /readyz` — readiness and local ranking implementation identifier.
- `POST /v1/matches` — query record and up to 50 candidate records.

Example request (synthetic data and a generic institution label only):

```json
{
  "query": {
    "record_id": "lost-01",
    "category": "phone",
    "description": "black phone with cracked screen",
    "observed_date": "2025-02-10",
    "location": "Example University library"
  },
  "candidates": [
    {
      "record_id": "found-04",
      "category": "phone",
      "description": "black phone cracked screen",
      "observed_date": "2025-02-11",
      "location": "Example University library"
    }
  ]
}
```

When EmbeddingGemma is loaded, each signal is named `embeddinggemma2_semantic_with_metadata` at version `v1`; otherwise the fallback reports `lexical_category_date_location` at version `v1`. Scores are bounded, uncalibrated ordering signals—not probabilities or confidence. Explanations are neutral overlap notes. Suggestions never establish identity or ownership, approve/reject claims, or disclose withheld evidence; human review remains authoritative. Empty candidates return an empty suggestions list. Validation is strict (`extra` fields are rejected), text is length-limited, contact-like email/phone text is rejected, candidate count is capped at 50, and the entire request body is capped at 64 KiB. Validation errors do not echo input. Blank dates from the Go API are treated as missing. Matching has an 8-second bounded timeout.

## Privacy and deployment

- Treat the service as **internal-only**: deploy on a private service network, do not publish/map its port to the host or internet, and allow only the trusted backend to call it. `EXPOSE` is container metadata, not a host port publication instruction; the root integrator owns private Compose wiring.
- The API has no default credential and does not log request bodies or PII. If `AI_SERVICE_TOKEN` is configured, `POST /v1/matches` requires `Authorization: Bearer <token>`; health/readiness remain available for probes. Supply secrets through the deployment's secret mechanism, never source control. Do not set a sample/default production token.
- Only pass the minimum synthetic or appropriately authorized record text necessary. Contact details are rejected from matching text, but this is not a comprehensive PII detector; upstream services must minimize/redact personal data. Never place private evidence in this API response or expose it to claimants.
- Suggestions must not verify identity/ownership, disclose private evidence, decide or reject claims, or be presented as proof. A human-controlled workflow must independently review records and claims.
- Institutional separation, authentication/authorization of callers, storage, retention, audit policy, and rate limits belong to the integrating backend and private network; this service does not provide tenant-aware storage.
- **Feature flag:** keep matching disabled by default in the integrating product; enable only behind an explicit backend feature flag after privacy/security review and authorized pilot approval. DIT is only a proposed pilot, not approved. Use generic `Example University` labels in synthetic tests and examples.
- Keep embeddings transient; do not embed contacts, account identifiers, private claims, evidence, or withheld verification clues. Keep the integrating Go API feature flag `AI_MATCHING_ENABLED=false` by default. Use of real records requires separate privacy, security, institutional, and operational review and an authorized pilot.

## Run and test

```sh
python3 -m pip install -r services/ai/requirements.txt
cd services/ai
EMBEDDINGGEMMA_MODEL_PATH=/workspace/embeddinggemma-2-google \
  uvicorn main:app --host 127.0.0.1 --port 18090 --no-access-log
```

In another terminal, check `/readyz` and submit the fictional API example above to `http://127.0.0.1:18090/v1/matches`. The service binds to loopback in this test command and must remain internal-only in deployments; do not publish its port directly to the internet. For container testing, layer `compose.embeddinggemma.yaml` over the root Compose file and set `EMBEDDINGGEMMA_MODEL_DIR`; the override mounts weights read-only and does not publish an AI host port. If a token is configured, send it only from the trusted backend. Do not enable Uvicorn access logs or request-body logging in production.
