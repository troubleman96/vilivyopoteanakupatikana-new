# Internal AI matching shortlist (v2)

Private FastAPI service for **ranking possible lost-and-found record matches**. When `EMBEDDINGGEMMA_MODEL_PATH` points to a local EmbeddingGemma 2 checkpoint, it combines semantic, lexical, category, date, and location signals. Without a model path it uses a deterministic lexical/metadata fallback. A configured but invalid path fails startup; weights are never downloaded.

The model is loaded once at startup from the local checkpoint and uses its asymmetric `SearchQuery` and `Document` prompts. Text weights only are loaded. Request embeddings exist only in process memory while ranking. No vector database, persistent embedding store, external model call, image inspection, or ownership decision is involved.

## API and limits

- `GET /healthz` — process liveness.
- `GET /readyz` — readiness plus the active ranking identifier. A validation container can set `EMBEDDINGGEMMA_REQUIRED=true` so it cannot become ready on the lexical fallback.
- `POST /v1/matches` — one query and up to **1,200 candidates**, request-body cap **1 MiB**, maximum response **five ranked suggestions**.

The integrating Go API filters staff candidates to the same institution, the opposite lost/found kind, approved public summaries, and non-closed/non-returned records. Staff can additionally select an exact-category filter and a 7-, 30-, or 90-day date window. Empty filters do not narrow the candidate pool. The service itself remains tenant-agnostic and receives only minimized public-safe summaries.

Example request (synthetic data and a generic institution label only):

```json
{
  "query": {
    "record_id": "lost-01",
    "category": "phone",
    "description": "black phone with cracked screen",
    "observed_date": "2026-09-12",
    "location": "Example University library"
  },
  "candidates": [
    {
      "record_id": "found-04",
      "category": "phone",
      "description": "black phone cracked screen",
      "observed_date": "2026-09-13",
      "location": "Example University library"
    }
  ]
}
```

The EmbeddingGemma ranking identifier is `embeddinggemma2_hybrid_lexical_metadata_v2`; the fallback is `hybrid_lexical_category_date_location_v2`. Model-enabled ranking weights semantic similarity at 60%, token/character lexical similarity at 25%, and category/date/location metadata at 15%. The deterministic fallback uses 70% lexical and 30% metadata. These weights are **uncalibrated ordering signals**, not probabilities, confidence, identity, or ownership. The lexical score uses character trigrams to help with spelling variants and is not a language-quality guarantee. Scores from different ranking versions are not directly comparable.

Explanations are neutral overlap notes. Responses never establish identity or ownership, approve/reject claims, disclose withheld evidence, or trigger an automatic match. The staff API labels every result `staff_review_required`; a person must inspect the shortlist and independently verify records and claims. The public search experience also caps AI-ranked results at five. Empty candidates return an empty list. Validation is strict (`extra` fields rejected), text is length-limited, contact-like email/phone text is rejected, and validation errors do not echo input. Matching has a bounded 60-second timeout for the full candidate window.

## Privacy and deployment

- Treat the service as **internal-only**: use a private service network, do not publish/map its port to the host or internet, and allow only the trusted backend to call it. `EXPOSE` is container metadata, not a host port publication instruction.
- The service does not log request bodies or PII. `AI_SERVICE_TOKEN_FILE` reads the bearer token from a mounted secret; production sets `AI_SERVICE_TOKEN_REQUIRED=true`, uses file-only injection, and configures the same high-entropy secret for the Go API. If a required file is absent/empty or both inline and file sources are supplied, requests fail closed. Never put a real token in source control, local examples, command output, or a browser.
- Only send the minimum synthetic or appropriately authorized record text necessary. Contact details are rejected, but this is not a comprehensive PII detector; upstream services must minimize/redact personal data. Never include private evidence, serial numbers, contact details, account identifiers, private claims, or withheld verification clues.
- Embeddings are transient. Suggestions are for human review only; they must not verify ownership, disclose private evidence, decide/reject claims, or be presented as proof.
- Keep the Go API feature flag `AI_MATCHING_ENABLED=false` unless privacy/security review and institutional approval are complete. The EmbeddingGemma Compose overlay is **validation-only** and deliberately does not enable API matching. DIT remains a proposed, not approved, pilot.
- Keep the service on the private network, keep Uvicorn access logs off, and keep host/edge logs free of matching request bodies. Use HTTPS at the public edge for any real deployment; see [`docs/deployment.md`](../../docs/deployment.md).

## Synthetic benchmark

Use synthetic examples only. Start the service with the local checkpoint and a loopback-only test bind, then run:

```sh
cd services/ai
EMBEDDINGGEMMA_MODEL_PATH=/workspace/embeddinggemma-2-google \
EMBEDDINGGEMMA_REQUIRED=true \
  uvicorn main:app --host 127.0.0.1 --port 18090 --no-access-log

# In another terminal from the repository root:
python3 services/ai/benchmarks/benchmark_matching.py \
  --base-url http://127.0.0.1:18090 \
  --distractors 1000 \
  --output /tmp/matching-benchmark.json
```

The benchmark exercises English, Swahili, code-switching, query typos, near-duplicates, and **1,000 distractors plus a relevant candidate per case**. It reports top-five hit/rank, model identifier and elapsed time. Passing this synthetic benchmark is a regression check, not evidence of acceptable real-world quality; use an institution-approved, privacy-reviewed, held-out evaluation set before any pilot. If `AI_SERVICE_TOKEN` is set, pass the synthetic test token with a local HTTP client configuration rather than adding a secret to the benchmark source.

## Container validation

The default CPU container installs CPU-only PyTorch/torchvision (no CUDA runtime) and the local EmbeddingGemma checkpoint must exist on the host at `/workspace/embeddinggemma-2-google` (or set `EMBEDDINGGEMMA_MODEL_DIR` to another authorized local checkpoint):

```sh
EMBEDDINGGEMMA_MODEL_DIR=/workspace/embeddinggemma-2-google \
  docker compose -f compose.yaml -f compose.embeddinggemma.yaml up -d --build ai
```

Verify `/readyz` from within the service/container or an attached private-network test container. The expected ranking is `embeddinggemma2_hybrid_lexical_metadata_v2`. The overlay mounts the model read-only, sets `EMBEDDINGGEMMA_REQUIRED=true`, and does not publish an AI host port or turn on `AI_MATCHING_ENABLED`. Remove the validation service when the test is finished. Production secrets, HTTPS, monitoring, retention, backups, and institutional approval remain separate deployment prerequisites.
