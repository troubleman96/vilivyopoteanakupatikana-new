# Vilivyopotea na Kupatikana

A Tanzania lost-and-found platform foundation in one repository: a responsive Next.js web app, Go API, private Python matching service, Next.js-powered developer portal, and read-only FastMCP adapter. The web UI is adapted from the [Next.js shadcn dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter); the starter’s license and attribution are retained.

## Monorepo architecture

| Area | Route or location | Purpose |
| --- | --- | --- |
| Public marketing site | `apps/landing/` (`http://localhost:3001`) | Explain the concept and link visitors to the product app. |
| Product app | `http://localhost:3000` | Public search, individual account routes, and `/docs`; links to the dedicated operator apps. |
| Individual user routes | `/dashboard/search`, `/dashboard/report`, `/dashboard/account` | Search reviewed listings and manage fictional report/claim previews. |
| Institution and security staff app | `apps/institution/` (`http://localhost:3004`) | Institution-scoped cases, claim review, and operational overview. |
| System administration app | `apps/admin/` (`http://localhost:3003`) | Institution directory, staff memberships, platform administrators, and audit review. |
| Developer documentation site | `apps/docs-site/` (`http://localhost:3006`) | Standalone VPK docs for all API endpoints, services, workflows, matching, security, and app integrations. |
| FastMCP server | `services/mcp/` | Optional read-only MCP tools for reviewed public listings and the active institution directory. |
| Go API | `services/api/` | Modular-monolith API, authentication checks, institution scoping, PostgreSQL migrations, and OpenAPI-ready routes. |
| Python AI service | `services/ai/` | Private matching-suggestion ranker with optional local EmbeddingGemma 2 semantic matching and a deterministic fallback. |

The product app, developer docs, landing site, institution workspace, and admin console are separate Next.js apps. Institution operations and system administration use separate deployable URLs. The product, Institution, and Admin apps share the PostgreSQL-backed Go API and session cookie; the apps do not grant trust themselves. The docs site is static documentation and does not call the API. Account sessions, institution membership, platform-admin access, and private data scopes are checked server-side.

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

Phase-five operational references: [HTTPS and secret-file deployment](docs/deployment.md), [privacy and retention proposal](docs/privacy-retention.md), [incident response template](docs/incident-response.md), and the [institution-approved pilot gate](docs/pilot-readiness.md). These are implementation materials, not institutional approval.

## Run the web app

Requirements: Node.js 22+ and pnpm 11+.

```bash
pnpm install --ignore-scripts
cp .env.example .env.local
pnpm dev
```

Run `pnpm landing:dev`, `pnpm institution:dev`, `pnpm admin:dev`, and `pnpm docs:dev` in separate terminals for the other apps at ports 3001, 3004, 3003, and 3006. The product app runs at port 3000; its root redirects to public search and its sidebar links to the operator apps. Configure `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_PRODUCT_APP_URL`, `NEXT_PUBLIC_INSTITUTION_APP_URL`, `NEXT_PUBLIC_ADMIN_APP_URL`, and `NEXT_PUBLIC_VPK_DOCS_URL` to change the local URLs. The product, Institution, and Admin origins must be allowed by `CORS_ALLOWED_ORIGINS` for cookie sessions; the landing and docs sites do not call the API. Every app uses Outfit for body text and Bricolage Grotesque for headings and emphasized text. The product app uses a fixed Lagoon palette; light or dark mode follows the operating system automatically. Demo role switching is only for preview; it never grants real permissions.

## Run the local stack

Requirements: Docker Engine with Compose v2, Node.js/pnpm, Go, and Python 3.12 for local tests.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD to a generated local-only value in .env.
# Generate one with: python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
docker compose up --build
```

Compose starts PostgreSQL on a private network, applies Go migrations, and starts the API, private AI service, product, marketing, Institution, and Admin apps. The docs app is run separately with `pnpm docs:dev`. The sites and API are published on localhost (ports 3000–3001 and 3003–3004, plus API 8080); PostgreSQL and AI are not host-published. Do not change `PUBLIC_BIND_ADDRESS` to expose these development ports publicly. For an authorized HTTPS deployment, follow [docs/deployment.md](docs/deployment.md) and its Caddy overlay prerequisites. Open <http://localhost:3000>, <http://localhost:3001>, <http://localhost:3003>, or <http://localhost:3004> for the four apps; API liveness is at <http://localhost:8080/healthz>. `docker compose down` stops services; `docker compose down -v` also deletes the local database volume.

The optional Compose MCP profile runs the MCP adapter on the private Docker network only; it publishes no host port:

```bash
docker compose --profile mcp up --build mcp
```

For an MCP client on your computer, use the local stdio transport instead (see [FastMCP docs](/docs/mcp)).

The full local stack uses the PostgreSQL credentials in `.env` and requires no external auth settings. Private API operations fail closed when PostgreSQL is unavailable. Verification and reset links are written to the local database outbox and are not delivered externally. The web-only `pnpm dev` command can still display fictional UI preview data, but cannot create or sign in to accounts without the API/database.

## Development and tests

```bash
make setup          # web dependencies, AI test extras, FastMCP test extras
pnpm dev             # product web app
pnpm docs:dev        # standalone VPK documentation app at localhost:3006
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
