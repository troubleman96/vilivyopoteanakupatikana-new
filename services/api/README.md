# Lost-and-found API (MVP)

A Go modular-monolith API for a multi-institution Tanzania lost-and-found service. This is an implementation scaffold, **not production-ready**. `Example University` and all demo records are synthetic. DIT is not represented as an approved pilot.

## Local PostgreSQL setup

Requirements: Go 1.22+, PostgreSQL 14+. Set `DATABASE_URL`, apply migrations, then run the API:

```sh
cd services/api
export DATABASE_URL='postgres://vilivyopotea:local-only-password@127.0.0.1:5432/vilivyopotea?sslmode=disable'
go run ./cmd/migrate
go run ./cmd/api
```

The Docker image includes `/api` as its default entrypoint and `/migrate` as a one-shot schema migration executable. The Compose stack starts PostgreSQL, runs migrations, and then starts the API. No hosted identity service is used.

## Identity and sessions

Local accounts are stored in `app_users`; passwords use bcrypt hashes. Registration creates an unverified account and queues a one-time link in `auth_email_outbox`; email verification is required before sign-in. Verification and password-reset tokens are stored as SHA-256 digests in `auth_email_tokens`. The outbox contains the raw links for **local synthetic testing only**—this phase has no external email delivery provider. Do not use real people’s email addresses or institutional data in the local outbox.

Sign-in puts a random opaque session token in the `__Host-vp_session` cookie (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`) and returns only user identity and expiry in JSON. PostgreSQL stores only the session digest. Sessions expire after 30 days; sign-out revokes the current session, sign-out-all revokes every session for the account, and password reset also revokes all sessions. Cookie-authenticated mutations require an allowed `Origin`; CORS uses exact entries from `CORS_ALLOWED_ORIGINS`.

Database-backed fixed-window throttles cover registration, sign-in (by client address and normalized account), email verification, verification resend, reset request, and reset confirmation. Limits are enforced by the API and shared across its instances through `auth_rate_limits`. Client addresses use the direct peer address; deployments behind a reverse proxy must put a reviewed, trusted rate limit at the edge or add an explicit trusted-proxy design rather than trusting arbitrary forwarded headers.

## Endpoints

- `GET /healthz` liveness; `GET /readyz` readiness.
- `POST /api/v1/auth/register` (202; generic response; queues local verification mail), `POST /api/v1/auth/login`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/verification/request`, `POST /api/v1/auth/password-reset/request`, `POST /api/v1/auth/password-reset/confirm`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all`, `GET /api/v1/auth/me`.
- `GET /api/v1/institutions`, `/api/v1/institutions/{institutionID}`.
- `GET /api/v1/items?q=...`, `/api/v1/items/search?q=...`, `/api/v1/items/{itemID}`: approved, public-safe projections only.
- `POST /api/v1/reports`: authenticated private report, held pending human review.
- `GET /api/v1/me/reports`; `POST /api/v1/me/claims`; `GET /api/v1/me/claims`.
- `GET /api/v1/staff/institutions/{institutionID}/cases`, `GET .../claims`, `PATCH .../cases/{caseID}`, `POST .../claims/{claimID}/review`, `POST .../items/{itemID}/review`, `POST .../cases/{caseID}/handover`.
- `GET /api/v1/institutions/{institutionID}/stats`, `GET /api/v1/platform/stats`.
- `POST /api/v1/staff/institutions/{institutionID}/matches/suggest`.

Every private route verifies a revocable PostgreSQL session from the HttpOnly cookie (the server retains bearer parsing for non-browser API clients). Staff/admin scope comes exclusively from active database membership; platform aggregates require explicit active platform-admin membership. Private user records are filtered by authenticated user ID. Staff queries and mutations scope records to the authorized institution. A case cannot be marked returned through the ordinary status endpoint: staff must first mark it matched, approve a claim for that case, then record a one-time handover linked to both the approved claim and the staff account. Errors use `{"error":{"code":"...","message":"..."}}`; private claims, contacts, evidence references, staff notes, and handover details never appear in public item DTOs.

The Python matching service receives only reviewed public-safe summaries. AI matching remains disabled by default and never decides ownership or approves claims. CORS is restricted to `CORS_ALLOWED_ORIGINS` (default `http://localhost:3000`).

## Tests

```sh
cd services/api
go test ./... # Unit/API tests; skips the PostgreSQL integration suite unless opted in
```

The opt-in integration suite creates **50 distinct synthetic accounts** and exercises verification/resend, Secure cookie flags and CSRF origin checks, registration/login throttling, password reset and session revocation, private report and claim isolation, tenant authorization, and the verified one-time handover flow. Point it only at a dedicated local database whose name contains `_test`:

```sh
createdb vilivyopotea_test
export DATABASE_URL='postgres://<local-db-user>:<local-db-password>@127.0.0.1:5432/vilivyopotea_test?sslmode=disable'
export TEST_DATABASE_URL="$DATABASE_URL"
go run ./cmd/migrate
TEST_DATABASE_URL="$TEST_DATABASE_URL" go test ./internal/api -run '^TestFiftyLocalPostgresAccountsAndIdentityHardening$' -count=1 -v
```

The suite refuses non-local or non-`_test` database URLs and cleans up its synthetic users, reports, claims, memberships, outbox messages, and extra institution after it runs. For a fresh database, apply the included demo seed migration as well so that a reviewed synthetic item is available for the claim test.

## Security / rollout caveats

Before deployment, complete institution onboarding and approval, privacy/legal review, a real email delivery provider and recovery runbook, rate-limit behavior behind the chosen edge/proxy, threat modeling, audit/monitoring, backup/restore, database least-privilege/RLS review, secure secret injection, outbox/token retention and deletion policies, and incident response. This MVP does not upload evidence; `evidence_reference` is private metadata only. Staff must independently verify ownership; AI output is never proof. Configure HTTPS at the deployment edge; session cookies always require `Secure`. The Go module path is `github.com/troubleman96/vilivyopoteanakupatikana-new/services/api`.
