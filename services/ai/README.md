# Internal AI matching suggestions

Small FastAPI service for **ranking possible lost-and-found record matches**. It is not an identity or ownership verifier, a claim adjudicator, or a source of calibrated probabilities. Uses a deterministic local lexical/category/date/location heuristic only; no external model calls, face recognition, or embedding checkpoint is used or downloaded.

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

Each suggestion includes a stable rank, a `lexical_category_date_location` signal at version `v1`, and short neutral overlap explanations. The numeric score is an **uncalibrated heuristic for ordering candidates**, not a probability or confidence claim. Empty candidates return an empty suggestions list. Validation is strict (`extra` fields are rejected), text is length-limited, contact-like email/phone text is rejected, candidate count is capped at 50, and the entire request body is capped at 64 KiB. Validation errors do not echo input. Matching has a 2-second async timeout; oversized bodies and timeout errors are bounded/safe.

## Privacy and deployment

- Treat the service as **internal-only**: deploy on a private service network, do not publish/map its port to the host or internet, and allow only the trusted backend to call it. `EXPOSE` is container metadata, not a host port publication instruction; the root integrator owns private Compose wiring.
- The API has no default credential and does not log request bodies or PII. If `AI_SERVICE_TOKEN` is configured, `POST /v1/matches` requires `Authorization: Bearer <token>`; health/readiness remain available for probes. Supply secrets through the deployment's secret mechanism, never source control. Do not set a sample/default production token.
- Only pass the minimum synthetic or appropriately authorized record text necessary. Contact details are rejected from matching text, but this is not a comprehensive PII detector; upstream services must minimize/redact personal data. Never place private evidence in this API response or expose it to claimants.
- Suggestions must not verify identity/ownership, disclose private evidence, decide or reject claims, or be presented as proof. A human-controlled workflow must independently review records and claims.
- Institutional separation, authentication/authorization of callers, storage, retention, audit policy, and rate limits belong to the integrating backend and private network; this service does not provide tenant-aware storage.
- **Feature flag:** keep matching disabled by default in the integrating product; enable only behind an explicit backend feature flag after privacy/security review and authorized pilot approval. DIT is only a proposed pilot, not approved. Use generic `Example University` labels in synthetic tests and examples.
- No model checkpoint is loaded or downloaded. Any future model use requires separate approval and privacy review.

## Run and test

```sh
cd /workspace/vilivyopoteanakupatikana.com/services/ai
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pytest
PORT=8090 uvicorn main:app --host 0.0.0.0 --port "${PORT:-8090}" --no-access-log
```

The container listens on `0.0.0.0:${PORT:-8090}` (default `8090`). Internal caller example: `curl -s http://localhost:8090/readyz`. If a token is configured, send it only from the trusted backend. Do not enable Uvicorn access logs or application request-body logging in production.
