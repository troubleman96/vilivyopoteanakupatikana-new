# VPK Developer Docs

Standalone Nextra 4 documentation app for the Vilivyopotea na Kupatikana platform. It documents the user, institution, and admin apps; all Go API endpoints; the PostgreSQL security model; matching and MCP services; and end-to-end workflows.

## Local development

From the VPK repository root:

```bash
pnpm install
pnpm docs:dev
```

Open [http://localhost:3006](http://localhost:3006). The docs app uses fictional examples and preserves the repository's pre-pilot framing. It does not call the VPK API.

## Build and run

```bash
pnpm docs:build
pnpm docs:start
```

Set `NEXT_PUBLIC_VPK_DOCS_URL` in VPK app build environments to the deployed docs URL. For local development, use `http://localhost:3006`.

## Content map

- `app/page.mdx` — platform overview and architecture diagram
- `app/architecture/` — runtime architecture, authorization, and data model
- `app/api/` — complete route catalog and detailed endpoint guides
- `app/services/` — Go API, ranking service, and read-only MCP adapter
- `app/workflows/` — reporting, claim verification/handover, ranking, and administration diagrams
- `app/apps/` — app-to-endpoint integration map and request examples
- `app/security/` — privacy, authorization, rate limits, and operations

Use fenced Mermaid blocks for diagrams. Route registrations in `services/api/internal/api/server.go`, handlers, and applied migrations remain the source of truth.
