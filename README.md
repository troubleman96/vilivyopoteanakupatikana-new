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
| Python AI service | `services/ai/` | Private, optional matching-suggestion ranker. It currently uses a deterministic lexical/category/date/location heuristic. |

The role areas and developer portal are routes in one Next.js app to preserve the shared Kiranism shell and design system. They are user experiences, not separate trust domains. Supabase identity, institution membership, platform-admin access, and private data scopes are checked server-side.

## Product and safety boundary

- Public search returns reviewed, redacted listings only. Claims, contact details, staff notes, evidence, and handover details are private.
- Supabase Auth is the default identity provider. No Supabase project credentials or real-user data are included.
- Staff verify claims and coordinate returns. AI only ranks possible matches; it cannot decide ownership, approve or reject claims, or reveal withheld evidence.
- **Embeddings are not active.** The Python service does not load EmbeddingGemma, generate vectors, or use a vector database. The docs describe embeddings and a possible future evaluation as future work, subject to approval and review.
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

Open <http://localhost:3000>. The public site, synthetic workspaces, and `/docs` run without credentials. Sign-in and registration show a setup state until Supabase is configured. The UI uses a fixed Supabase palette and Outfit font; light or dark mode follows the operating system automatically, with no in-app appearance controls. Demo role switching is only for preview; it never grants real permissions.

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
make setup          # web dependencies, AI test extras, FastMCP test extras
pnpm dev             # web + documentation site
make api-test        # Go API tests
make ai-test         # Python AI service tests
make mcp-test        # FastMCP safety/projection tests
make test            # web checks + Go tests + AI and MCP tests
```

`NEXT_PUBLIC_API_BASE_URL` selects the Go API for public search (the example environment uses `http://localhost:8080/api/v1`). The AI service is private to the Compose network. AI matching is disabled by default (`AI_MATCHING_ENABLED=false`); staff-only matching falls back to tenant-scoped text search unless explicitly enabled after privacy/security review.

For a standalone MCP process, install its isolated dependencies and run `services/mcp/server.py`. `MCP_TRANSPORT` defaults to `stdio`; `VILIVY_API_BASE_URL` defaults to `http://localhost:8080/api/v1`. For local HTTP development, set `MCP_TRANSPORT=http`; it binds to `127.0.0.1` by default. Do not expose this development endpoint publicly without adding and reviewing appropriate authentication and operational controls.

## Repository branches

The application monorepo is published on the `monorepo` branch of <https://github.com/troubleman96/vilivyopoteanakupatikana-new>. The repository's existing `main` branch remains unchanged. The original Next.js starter is linked above for provenance; product work belongs in the user-owned repository, never in the starter repository.
