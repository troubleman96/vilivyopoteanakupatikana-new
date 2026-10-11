# Vilivyopotea na Kupatikana

A Tanzania lost-and-found service foundation in one repository: a responsive Next.js web app, a Go API, and a private Python matching service. The web UI is adapted from the [Next.js shadcn dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter); the starter’s license and attribution are retained.

## Monorepo layout

```text
src/                  Next.js public site and role-preview workspaces
services/api/         Go modular-monolith API, PostgreSQL migrations, OpenAPI
services/ai/          Private Python matching service (assistive suggestions only)
compose.yaml          Local database, migrations, API, AI, and web stack
Makefile              Common development and test commands
```

## Product and safety boundary

- Public search returns reviewed, redacted listings only. Claims, contact details, staff notes, evidence, and handover details are private.
- Supabase Auth is the default identity provider. No Supabase project credentials or real-user data are included.
- Staff verify claims and coordinate returns. AI only ranks possible matches; it cannot decide ownership, approve or reject claims, or reveal withheld evidence.
- All records and institution names are synthetic. DIT is a proposed pilot only; it has not approved a pilot and is not represented as a partner.
- SendAfrica and MailAfrica integrations are deferred. No email/SMS provider is configured.
- This is a pre-pilot foundation, not authorization to collect personal data or launch. Obtain institutional approval and complete local privacy, security, retention, abuse-response, accessibility, and operational reviews first.

## Run the UI demo

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install --ignore-scripts
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>. The public site and synthetic workspaces run without credentials. Sign-in and registration show a setup state until Supabase is configured. The UI uses a fixed Supabase palette and Outfit font; light or dark mode follows the operating system automatically, with no in-app appearance controls. Demo role switching is only for preview; it never grants real permissions.

## Run the local stack

Requirements: Docker Engine with Compose v2, Node.js/pnpm, Go, and Python 3.12 for local tests.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD to a generated local-only value in .env.
# Generate one with: python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
docker compose up --build
```

Compose starts PostgreSQL on a private network, applies Go migrations, and starts the API, private AI service, and web app. By default only web and API are published on localhost (ports 3000 and 8080); PostgreSQL and AI are not host-published. For a temporary hosted test URL, set `PUBLIC_BIND_ADDRESS=0.0.0.0` in the local `.env`; adjust `WEB_HOST_PORT` and `API_HOST_PORT` if those ports are occupied. Do not use the all-interface setting for an untrusted public deployment. Open <http://localhost:3000>; API liveness is at <http://localhost:8080/healthz>. `docker compose down` stops services; `docker compose down -v` also deletes the local database volume.

Without Supabase settings, public demo reads can use synthetic API fixtures and private operations fail closed. To enable Supabase Auth, configure both browser and server values in `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Use only the anon/public key. Never place a service-role key in `NEXT_PUBLIC_*` or commit credentials. The Go API validates bearer access tokens against Supabase Auth; it does not issue a fake identity.

## Development and tests

```bash
make web-typecheck
make web-build
make api-test
make ai-setup       # install Python test dependencies
make ai-test
make test           # web checks + Go tests + Python tests
```

`NEXT_PUBLIC_API_BASE_URL` selects the Go API for public search (the example environment uses `http://localhost:8080/api/v1`). The AI service is private to the Compose network. AI matching is disabled by default (`AI_MATCHING_ENABLED=false`); staff-only matching falls back to tenant-scoped text search unless explicitly enabled after privacy/security review.

## Repository branches

The application monorepo is published on the `monorepo` branch of <https://github.com/troubleman96/vilivyopoteanakupatikana-new>. The repository's existing `main` branch remains unchanged. The original Next.js starter is linked above for provenance; product work belongs in the user-owned repository, never in the starter repository.
