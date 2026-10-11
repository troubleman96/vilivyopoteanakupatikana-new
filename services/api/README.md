# Lost-and-found API (MVP)

A Go modular-monolith API for a multi-institution Tanzania lost-and-found service. This is an implementation scaffold, **not production-ready**. `Example University` and all demo records are synthetic. DIT is not represented as an approved pilot.

## Run

Requirements: Go 1.22+, PostgreSQL 14+. Copy `.env.example` to `.env` and configure environment variables. Set `DEMO_READS=true` to enable explicit synthetic public fixture reads when the database is absent. This mode exposes only approved/redacted fixtures; all private writes still fail closed.

```sh
cd services/api
go test ./...
go run ./cmd/api
```

The Docker image includes `/api` as its default entrypoint and `/migrate` as a one-shot schema migration executable, with migration SQL bundled in `/app/migrations`.

For database mode set `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`, then `go run ./cmd/migrate` followed by `go run ./cmd/api`. Auth is checked by calling Supabase Auth `/auth/v1/user` using the supplied bearer token and anon key with a short timeout. Tokens and request bodies are not logged. Do not use fake identities or client-supplied role/institution claims. Database membership is checked for each institution-scoped request.

## Endpoints

- `GET /healthz` liveness; `GET /readyz` readiness.
- `GET /api/v1/institutions`, `/api/v1/institutions/{institutionID}`.
- `GET /api/v1/items?q=...`, `/api/v1/items/{itemID}`: approved, public-safe projections only.
- `POST /api/v1/reports`: authenticated report, held private pending staff review. Staff can make a reviewed/redacted public projection via `POST /api/v1/staff/institutions/{institutionID}/items/{itemID}/review`.
- `GET /api/v1/me/reports`; `POST /api/v1/me/claims`; `GET /api/v1/me/claims`.
- `GET /api/v1/staff/institutions/{institutionID}/cases`, `GET .../claims`, `PATCH .../cases/{caseID}`, `POST .../claims/{claimID}/review`, `POST .../cases/{caseID}/handover`.
- `GET /api/v1/institutions/{institutionID}/stats`, `GET /api/v1/platform/stats`.
- `POST /api/v1/staff/institutions/{institutionID}/matches/suggest`: staff-only suggestions from reviewed public-safe records in the same institution. Matching is disabled by default (`AI_MATCHING_ENABLED=false`); the endpoint then uses tenant-scoped text search. Enabling the private Python ranker requires an explicit feature flag and optional `AI_SERVICE_TOKEN`; suggestions never decide claims. CORS is restricted to comma-separated `CORS_ALLOWED_ORIGINS` (default `http://localhost:3000`).

Private and staff routes require a verified Supabase identity and a configured database. Staff/admin scope comes exclusively from active database membership; platform aggregate data requires explicit active platform admin membership. Errors use `{"error":{"code":"...","message":"..."}}`. Private claims, contacts, evidence references, staff notes and handover data are never included in public item DTOs.

## Security / rollout caveats

Before deployment, complete institution onboarding and approval, privacy/legal review, retention and evidence-storage design, threat modeling, rate limiting, audit trails, backup/restore, monitoring, secure secret injection, database least-privilege/RLS review, and operational incident procedures. This MVP does not upload evidence; `evidence_reference` is private metadata only. Staff should independently verify ownership; the API never treats AI output as a decision. Configure HTTPS at the deployment edge. The Go module path is `github.com/troubleman96/vilivyopoteanakupatikana-new/services/api`.
