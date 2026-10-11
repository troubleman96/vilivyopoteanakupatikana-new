# Deployment and operational controls

This repository is a pre-pilot product monorepo, not an approved production service. The root Next.js application, Go API, private Python matching service and optional FastMCP adapter are separate services. **Use synthetic data only until the written institution-approval gate is complete.**

## Local development

The base `compose.yaml` binds the standalone marketing site, product app, Institution app, Admin app, and API to localhost by default; PostgreSQL and AI remain on private Docker networks. The product app is `http://localhost:3000`, marketing is `:3001`, Admin is `:3003`, and Institution is `:3004` (3002 is already occupied on the development host). Browser API origins must include all three authenticated apps in `CORS_ALLOWED_ORIGINS`. Local `.env` values are for synthetic testing only. Do not commit `.env` files, secret mounts, backups, certificate data or real user/institution records. `AI_MATCHING_ENABLED` remains `false` by default.

Start an app with `pnpm institution:dev` or `pnpm admin:dev`. Both use the product app's local session cookie and Go API. The Admin console requires a verified account already assigned in `platform_admins`; register and verify an account, then have the database operator bootstrap the first platform administrator once: `INSERT INTO platform_admins(user_id, active) SELECT id, true FROM app_users WHERE lower(email)=lower('operator@example.org') AND active=true AND email_verified=true ON CONFLICT(user_id) DO UPDATE SET active=true;`. Run that SQL using the protected migration/owner connection, replace the email, and verify one row was affected. After bootstrap, platform administrators can create institutions, assign or suspend registered staff, grant/revoke platform-admin access, and review the protected audit stream from the Admin app. The API prevents removal of the final active administrator.

## Production HTTPS overlay

The `compose.production.yaml` overlay removes direct host-published app/API ports and adds Caddy on ports 80/443. Caddy obtains and renews HTTPS certificates automatically; `PUBLIC_HOSTNAME` serves the product app/API and `LANDING_HOSTNAME` serves the standalone marketing site. Before starting it, an authorized operator must configure public DNS for both hostnames, allow inbound TCP 80/443 (and UDP 443 for HTTP/3), and set `ACME_EMAIL`. Caddy certificate/private-key state lives in its named Docker volume and needs protected backup/access controls. Do not expose PostgreSQL, AI, `/metrics`, or the API directly.

Create a separate, permission-restricted `.env.production` containing non-secret settings and **file paths**, not secret values. Set `PUBLIC_HOSTNAME`, `LANDING_HOSTNAME`, `INSTITUTION_HOSTNAME`, `ADMIN_HOSTNAME`, `ACME_EMAIL`, `AI_MATCHING_ENABLED=false`, `POSTGRES_PASSWORD_FILE`, `POSTGRES_APP_PASSWORD_FILE`, `MIGRATION_DATABASE_URL_FILE`, `RUNTIME_DATABASE_URL_FILE`, and `AI_SERVICE_TOKEN_FILE`; the corresponding files must exist before Compose starts. The mounted files contain, respectively, the PostgreSQL bootstrap password, runtime-role password, migration-owner DSN, restricted runtime-role DSN, and internal AI bearer token. Keep the owner DSN mounted only in the one-shot `migrate` service. Protect source files outside the repository with the approved secret-store/host permissions. Never put the secrets themselves in `.env.production`.

A reviewed operator may validate/launch the overlay with:

```sh
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml config
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml up --build -d
```

The overlay pins Caddy to `172.30.40.10/24` by default and sets that exact address as the only trusted proxy for rate-limit client-IP extraction. If the default network conflicts with an existing subnet, change `APP_NETWORK_SUBNET`, `CADDY_APP_IP`, and `TRUSTED_PROXY_CIDRS` together; do not broaden the trusted range casually. Caddy overwrites `X-Forwarded-For`; the API ignores forwarded IP headers from every untrusted peer. Production origins and browser API URL are built as the selected HTTPS hostname. Change domain/CORS choices before deployment and rebuild the web image after changing them.

The overlay mounts secrets read-only using Compose file secrets. The API/migration tools also support `DATABASE_URL_FILE`, `APP_DATABASE_PASSWORD_FILE`, and `AI_SERVICE_TOKEN_FILE` in other approved runtimes; supplying a non-empty inline value and a file path together is rejected. Enabling AI matching requires a non-empty internal token on the Go API and an authenticated private AI service. No production hostname, secret values, certificate, mail provider, monitoring backend or institution configuration is set in this repository.

## Rate limiting, logs and monitoring

Shared PostgreSQL fixed-window limits apply to authentication, public listing/search, report and claim submissions, and staff matching. Account/IP bucket identifiers are hashed in the database. The initial values are conservative starting points and require review against pilot traffic and any legal/accessibility requirements. `GET /metrics` reports process-local aggregate request/status/duration and throttle counters only; scrape it from a private network and never proxy it publicly. API JSON logs include request ID, method, coarse route family, status and duration, but not IPs, query strings, bodies, tokens, claim text, contact details or record descriptions.

Staff listing/claim/case/handover decisions and matching-shortlist requests are transactionally captured in the tenant-RLS `operational_audit_events` table. Metadata is bounded and content-free. The table is not exposed by a public endpoint; access and review of audit rows must be assigned to authorized institutional operators.

## Backups, restore and retention

Use `scripts/ops/backup-postgres.sh` from an approved backup runner with a dedicated backup role and passfile secret. The script validates custom-format archives, writes checksums, requires age encryption by default, and requires an explicit approved `BACKUP_RETENTION_DAYS`. Set `BACKUP_AGE_RECIPIENT` to an institution-custodied public recipient; keep the private identity separate from backup storage. Use a protected/ephemeral `TMPDIR` for plaintext staging. Plaintext backup output is refused unless both `BACKUP_ENCRYPTION_REQUIRED=false` and `BACKUP_ALLOW_UNENCRYPTED_SYNTHETIC=true` are explicitly set for a synthetic local test.

Run `scripts/ops/restore-drill-postgres.sh <archive>` only against a newly created disposable database ending in `_restore_test`. It restores without silently dropping existing objects and checks for the application schema. Run drills in an isolated environment and record the date, archive checksum, result, elapsed time and RPO/RTO. Never point the drill script at a production database.

`docs/privacy-retention.md` contains an explicit proposed schedule for institution review. `scripts/ops/retention-sweep.sh` requires all five retention durations and a maintenance-role passfile; it has no automatic schedule and deletes nothing unless an operator intentionally runs it. Approve/adjust periods with the institution before scheduling it. Backups also need a tested deletion/expiry process, encrypted storage and key-custody review.

## Incident response and pilot gate

Use `docs/incident-response.md` as a local runbook template; before a pilot, name real institutional incident/security/privacy contacts and determine applicable notification timelines. See `docs/pilot-readiness.md` for the written approval and service-readiness gate. DIT has not approved a pilot, so do not enable live traffic, use real records, or set `AI_MATCHING_ENABLED=true` unless/until the authorized institution grants written approval and all required deployment controls have been verified.
