# Vilivyopotea na Kupatikana

A Tanzania lost-and-found platform foundation in one repository: a responsive Next.js web app, Go API, private Python matching service, Next.js-powered developer portal, and read-only FastMCP adapter. The web UI is adapted from the [Next.js shadcn dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter); the starter’s license and attribution are retained.

## Monorepo architecture

| Area | Route or location | Purpose |
| --- | --- | --- |
| Public landing page | `/` | Explain the service and direct people to safe search and reporting. |
| Individual user app | `/dashboard/search`, `/dashboard/report`, `/dashboard/account` | Search reviewed listings and manage fictional report/claim previews. |
| Institution and security staff | `/dashboard/cases`, `/dashboard/claims`, `/dashboard/institution` | Institution-scoped casework, private claim review, and staff overview. |
| System administration | `/dashboard/platform` | Platform-level operational aggregates; access is enforced by the API in a configured deployment. |
| Developer documentation site | `/docs` | Next.js docs covering architecture, API, Python AI and embeddings, web app, MCP, and security boundaries. |
| FastMCP server | `services/mcp/` | Optional read-only MCP tools for reviewed public listings and the active institution directory. |
| Go API | `services/api/` | Modular-monolith API, authentication checks, institution scoping, PostgreSQL migrations, and OpenAPI-ready routes. |
| Python AI service | `services/ai/` | Private matching-suggestion ranker with optional local EmbeddingGemma 2 semantic matching and a deterministic fallback. |

The role areas and developer portal are routes in one Next.js app to preserve the shared Kiranism shell and design system. They are user experiences, not separate trust domains. Local PostgreSQL accounts, institution membership, platform-admin access, and private data scopes are checked server-side.

## Product and safety boundary

- Public search returns reviewed, redacted listings only. Claims, contact details, staff notes, evidence, and handover details are private.
- Local account authentication uses PostgreSQL and bcrypt. New accounts must verify email before sign-in; random one-time verification and password-reset tokens are stored as digests, and reset revokes existing sessions. Browser sessions use `Secure`, `HttpOnly`, `SameSite=Lax` cookies, are revocable individually or across all devices, and are never returned as JSON bearer tokens.
- Auth requests use persistent PostgreSQL rate-limit buckets. Verification and reset messages go only to the private local database outbox in this phase; no email provider is configured, so use synthetic `.test` addresses only.
- Staff verify claims and coordinate returns. AI only ranks possible matches; it cannot decide ownership, approve or reject claims, or reveal withheld evidence.
- EmbeddingGemma 2 is integrated as an optional, local-only text ranker. It loads only from a mounted/configured checkpoint, applies the model's retrieval query/document prompts, and does not persist vectors or use a vector database. The app-level matching feature flag remains off by default; AI suggestions never verify ownership or decide claims.
- All records and institution names are synthetic. DIT is a proposed pilot only; it has not approved a pilot and is not represented as a partner.
- SendAfrica and MailAfrica integrations are deferred. No email/SMS provider is configured.
- The MCP server is read-only and has no tools for private reports, claims, staff queues, handovers, or administration. Its HTTP mode should remain local or behind a reviewed, trusted network boundary.
- This is a pre-pilot foundation, not authorization to collect personal data or launch. Obtain institutional approval and complete local privacy, security, retention, abuse-response, accessibility, and operational reviews first.

## Run the web app

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install --ignore-scripts
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>. The public site, synthetic workspaces, and `/docs` run without account credentials. Sign-in and registration require the local Go API and PostgreSQL stack. The UI uses a fixed lagoon palette and Outfit font; light or dark mode follows the operating system automatically, with no in-app appearance controls. Demo role switching is only for preview; it never grants real permissions.

## Run the local stack

Requirements: Docker Engine with Compose v2, Node.js/pnpm, Go, and Python 3.12 for local tests.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD to a generated local-only value in .env.
# Generate one with: python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
docker compose up --build
```

Compose starts PostgreSQL on a private network, applies Go migrations, and starts the API, private AI service, and web app. By default only web and API are published on localhost (ports 3000 and 8080); PostgreSQL and AI are not host-published. For a temporary hosted test URL, set `PUBLIC_BIND_ADDRESS=0.0.0.0` in the local `.env`; adjust `WEB_HOST_PORT` and `API_HOST_PORT` if those ports are occupied. Do not use the all-interface setting for an untrusted public deployment. Open <http://localhost:3000>; API liveness is at <http://localhost:8080/healthz>. `docker compose down` stops services; `docker compose down -v` also deletes the local database volume.

The optional Compose MCP profile runs the MCP adapter on the private Docker network only; it publishes no host port:

```bash
docker compose --profile mcp up --build mcp
```

For an MCP client on your computer, use the local stdio transport instead (see [FastMCP docs](/docs/mcp)).

The full local stack uses the PostgreSQL credentials in `.env` and requires no external auth settings. Private API operations fail closed when PostgreSQL is unavailable. Verification and reset links are written to the local database outbox and are not delivered externally. The web-only `pnpm dev` command can still display fictional UI preview data, but cannot create or sign in to accounts without the API/database.

## Development and tests

```bash
make setup          # web dependencies, AI test extras, FastMCP test extras
pnpm dev             # web + documentation site
make api-test        # Go API tests
TEST_DATABASE_URL=postgres://.../vilivyopotea_test make api-test-50  # 50-account PostgreSQL auth/isolation/handover integration suite
make ai-test         # Python AI service tests
make mcp-test        # FastMCP safety/projection tests
make test            # web checks + Go tests + AI and MCP tests
```

`NEXT_PUBLIC_API_BASE_URL` selects the Go API for public search (the example environment uses `http://localhost:8080/api/v1`). The AI service is private to the Compose network. AI matching is disabled by default (`AI_MATCHING_ENABLED=false`); staff-only matching falls back to tenant-scoped text search unless explicitly enabled after privacy/security review.

### Run and test the AI service separately

The Python service can be run independently for synthetic API tests. Install dependencies, set the local checkpoint path, and start it on a separate port:

```bash
python3 -m pip install -r services/ai/requirements.txt
cd services/ai
EMBEDDINGGEMMA_MODEL_PATH=/workspace/embeddinggemma-2-google \
  uvicorn main:app --host 127.0.0.1 --port 18090 --no-access-log
```

In another terminal, verify readiness and post fictional records:

```bash
curl -s http://127.0.0.1:18090/readyz
curl -s http://127.0.0.1:18090/v1/matches \
  -H 'Content-Type: application/json' \
  -d '{"query":{"record_id":"lost-01","category":"phone","description":"black phone with cracked screen","observed_date":"2025-02-10","location":"Example University library"},"candidates":[{"record_id":"found-01","category":"phone","description":"black handset with damaged display","observed_date":"2025-02-11","location":"Example University library"}]}'
```

`/readyz` identifies whether EmbeddingGemma or the deterministic fallback is active. Model weights are never fetched at runtime; an invalid configured path fails startup rather than silently falling back. The Python service remains private and should not be exposed directly to the internet. See [`services/ai/README.md`](services/ai/README.md) for the optional Compose model override and response semantics.

For a standalone MCP process, install its isolated dependencies and run `services/mcp/server.py`. `MCP_TRANSPORT` defaults to `stdio`; `VILIVY_API_BASE_URL` defaults to `http://localhost:8080/api/v1`. For local HTTP development, set `MCP_TRANSPORT=http`; it binds to `127.0.0.1` by default. Do not expose this development endpoint publicly without adding and reviewing appropriate authentication and operational controls.

## Repository branches

The application monorepo is published on the `monorepo` branch of <https://github.com/troubleman96/vilivyopoteanakupatikana-new>. The repository's existing `main` branch remains unchanged. The original Next.js starter is linked above for provenance; product work belongs in the user-owned repository, never in the starter repository.
