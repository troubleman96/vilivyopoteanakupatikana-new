# Lost-and-found API (MVP)

A Go modular-monolith API for a multi-institution Tanzania lost-and-found service. This is an implementation scaffold, **not production-ready**. Demo records are synthetic, are not inserted into PostgreSQL, and are not returned as an API fallback. DIT is not represented as an approved pilot.

## Local PostgreSQL setup

Requirements: Go 1.22+, PostgreSQL 14+. Migrations run with an owner/migration connection and provision a separate non-owner, `NOBYPASSRLS` API login. Use a strong URL-safe runtime password (or percent-encode it in `DATABASE_URL`):

```sh
cd services/api
export DATABASE_URL='postgres://<migration-owner>:<owner-password>@127.0.0.1:5432/vilivyopotea?sslmode=disable'
export APP_DATABASE_USER='vilivyopotea_app'
export APP_DATABASE_PASSWORD='<strong-url-safe-secret>'
go run ./cmd/migrate
export DATABASE_URL='postgres://vilivyopotea_app:<strong-url-safe-secret>@127.0.0.1:5432/vilivyopotea?sslmode=disable'
go run ./cmd/api
```

The migration connection must be a trusted superuser (or equivalent role authorized to create `BYPASSRLS` roles) that can create/alter the application login and apply schema migrations. A separate `NOLOGIN` public-view owner has `BYPASSRLS` only so forced RLS cannot hide approved listings from the public view; it is granted only allow-listed public columns, owns the safe view and predicate, and has no role memberships. The application login is never a member of it and remains `NOBYPASSRLS`. Never run `/api` with the migration-owner credentials. The Docker image includes `/api` as its default entrypoint and `/migrate` as a one-shot schema migration executable. Compose starts PostgreSQL, runs migrations and grants, then starts the API using the restricted role. No hosted identity service is used.

For production, provide `DATABASE_URL_FILE` and `APP_DATABASE_PASSWORD_FILE` as read-only mounted secret paths for the migration process, and `DATABASE_URL_FILE` for the API runtime role. The file contents are read at process start and are never logged; configuring both a non-empty inline value and a file path is rejected. Keep the owner DSN available only to the one-shot migration service.

New database migrations do not insert sample institutions or listings. Upgrades also hide the three exact legacy seed listings in place; linked claims and unrelated institution/user records are preserved. When PostgreSQL is missing or unavailable, the API reports `503` for readiness and data routes instead of returning sample records. The browser’s synthetic dashboard preview is off by default; only enable `NEXT_PUBLIC_DEMO_MODE=true` for an isolated local preview, and never enable it for production.

## Database tenant isolation

Institution-scoped tables use PostgreSQL row-level security with `FORCE ROW LEVEL SECURITY`. The API opens transactions and sets user/institution context locally for each private or staff operation. Composite foreign keys reject cases or handovers connected to a different institution’s record. Anonymous listing and claim lookup use a database view that projects only approved public fields; the app role cannot use that view to select private item columns. The runtime role is non-owner, non-superuser, and `NOBYPASSRLS`. This database context assumes the API process and its database credentials are trusted; do not expose those credentials to browsers or other tenants.

## Identity and sessions

Local accounts are stored in `app_users`; passwords use bcrypt hashes. Registration creates an unverified account and queues a one-time link in `auth_email_outbox`; email verification is required before sign-in. Verification and password-reset tokens are stored as SHA-256 digests in `auth_email_tokens`. The outbox contains the raw links for **local synthetic testing only**—this phase has no external email delivery provider. Do not use real people’s email addresses or institutional data in the local outbox.

Sign-in puts a random opaque session token in the `__Host-vp_session` cookie (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`) and returns only user identity and expiry in JSON. PostgreSQL stores only the session digest. Sessions expire after 30 days; sign-out revokes the current session, sign-out-all revokes every session for the account, and password reset also revokes all sessions. Cookie-authenticated mutations require an allowed `Origin`; CORS uses exact entries from `CORS_ALLOWED_ORIGINS`.

Database-backed fixed-window throttles cover registration, sign-in (by client address and normalized account), email verification, verification resend, reset request, reset confirmation, public listing/search by client address, report/claim submissions by account, and staff matching by account and institution. Limits are enforced by the API and shared across instances through hashed `auth_rate_limits` buckets. Forwarded client addresses are used only when the direct peer belongs to an explicitly configured `TRUSTED_PROXY_CIDRS` range; the proxy must overwrite `X-Forwarded-For` with one client IP. Arbitrary forwarded headers are ignored. Initial per-route limits are conservative defaults and must be reviewed against approved pilot traffic.

The API emits JSON request logs with a random `X-Request-ID`, a coarse route family, status, and duration; it does not log query strings, request bodies, client addresses, tokens, or record text. `GET /metrics` exposes process-local low-cardinality counters and duration totals for private-network scraping; do not route it through the public edge. Staff review, case/claim/handover, and shortlist-request events are written transactionally to `operational_audit_events` under tenant RLS. Audit details are limited to action/status/method/count/filter flags, never notes, contact data, or matching text. The table has no public route.

## Endpoints

- `GET /healthz` liveness; `GET /readyz` readiness.
- `POST /api/v1/auth/register` (202; generic response; queues local verification mail), `POST /api/v1/auth/login`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/verification/request`, `POST /api/v1/auth/password-reset/request`, `POST /api/v1/auth/password-reset/confirm`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all`, `GET /api/v1/auth/me`.
- `GET /api/v1/institutions`, `/api/v1/institutions/{institutionID}`.
- `GET /api/v1/items?q=...`, `/api/v1/items/search?q=...`, `/api/v1/items/{itemID}`: approved, public-safe projections only.
- `POST /api/v1/reports`: authenticated private report, held pending human review.
- `GET /api/v1/me/reports`; `POST /api/v1/me/claims`; `GET /api/v1/me/claims`.
- `GET /api/v1/staff/institutions/{institutionID}/cases`, `GET .../claims`, `PATCH .../cases/{caseID}`, `POST .../claims/{claimID}/review`, `POST .../claims/{claimID}/verification`, `POST .../items/{itemID}/review`, `POST .../cases/{caseID}/handover`.
- `GET /api/v1/institutions/{institutionID}/stats`, `GET /api/v1/platform/stats`.
- `POST /api/v1/staff/institutions/{institutionID}/matches/suggest`.

Every private route verifies a revocable PostgreSQL session from the HttpOnly cookie (the server retains bearer parsing for non-browser API clients). Staff/admin scope comes exclusively from an active staff or institution-admin membership checked on each institution-scoped endpoint; platform aggregates require explicit active platform-admin membership. Private user records are filtered by authenticated user ID. Staff queries and mutations scope records to the authorized institution. A case cannot be marked returned through the ordinary status endpoint: staff must first mark it matched, approve a claim for that case, record a separate verification tied to that exact claim approval, then record a one-time handover linked to the verified claim and staff account. Database row-security policies and triggers also reject handovers or returned statuses that do not have this current verification record. Claims can only be created against found-item listings. Errors use `{"error":{"code":"...","message":"..."}}`; private claims, contacts, evidence references, staff notes, and handover details never appear in public item DTOs.

The Python matching service receives only reviewed public-safe summaries. AI matching remains disabled by default and never decides ownership or approves claims. CORS is restricted to `CORS_ALLOWED_ORIGINS` (default `http://localhost:3000`).

## Tests

```sh
cd services/api
go test ./... # Unit/API tests; skips the PostgreSQL integration suite unless opted in
```

The opt-in integration suite creates **50 synthetic accounts** and synthetic institutions/items inside its dedicated local `_test` database. In addition to identity/session and verified handover tests, it verifies role and institution authorization on every staff endpoint, rejects claims against missing listings, exercises direct database return/handover bypass attempts, checks row-security filtering and tenant-consistent foreign keys, and confirms that the public database view contains no private columns. Supply an owner connection for fixture setup/cleanup and a separate non-owner app connection for API and RLS operations:

```sh
createdb vilivyopotea_phase3_test
export TEST_DATABASE_URL='postgres://<local-db-owner>:<owner-password>@127.0.0.1:5432/vilivyopotea_phase3_test?sslmode=disable'
export APP_DATABASE_USER='vilivyopotea_app'
export APP_DATABASE_PASSWORD='<strong-url-safe-secret>'
export DATABASE_URL="$TEST_DATABASE_URL"
go run ./cmd/migrate
export TEST_APP_DATABASE_URL='postgres://vilivyopotea_app:<strong-url-safe-secret>@127.0.0.1:5432/vilivyopotea_phase3_test?sslmode=disable'
TEST_DATABASE_URL="$TEST_DATABASE_URL" TEST_APP_DATABASE_URL="$TEST_APP_DATABASE_URL" go test ./internal/api -run '^TestFiftyLocalPostgresAccountsAndIdentityHardening$' -count=1 -v
```

The suite refuses non-local or non-`_test` database URLs, rejects a superuser/owner/BYPASSRLS runtime role, and cleans up only the synthetic records it created. It never depends on pre-existing institutions or seeded listings; no demo seed is needed. Use only a disposable test database, never production.

## Security / rollout caveats

Before deployment, complete institution onboarding and approval, privacy/legal review, a real email delivery provider and recovery runbook, rate-limit behavior behind the chosen edge/proxy, threat modeling, audit/monitoring, backup/restore, independent least-privilege/RLS review of the deployed role and policies, secure secret injection, outbox/token retention and deletion policies, and incident response. This MVP does not upload evidence; `evidence_reference` is private metadata only. Staff must independently verify ownership; AI output is never proof. Configure HTTPS at the deployment edge; session cookies always require `Secure`. The Go module path is `github.com/troubleman96/vilivyopoteanakupatikana-new/services/api`.
