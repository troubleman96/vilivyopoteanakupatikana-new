# Deployment

This repository is a pre-pilot product monorepo, not the unmodified dashboard starter. The root Next.js application serves the public landing page, individual workspace, institution/security-staff workspace, system-admin preview, and developer docs. The Go API, private Python matching service, and optional FastMCP adapter are separate services.

## Web application

The Next.js app can deploy to Vercel or anywhere Docker runs. `next.config.ts` enables standalone output when `BUILD_STANDALONE=true`. Configure `NEXT_PUBLIC_API_BASE_URL` to point to the Go API. Account sign-up and sign-in are served by the Go API and require PostgreSQL; the web app has no third-party identity dependency.

For other platforms, see the [Next.js deployment docs](https://nextjs.org/docs/app/getting-started/deploying).

## Environment and trust boundaries

- `NEXT_PUBLIC_API_BASE_URL` points the browser to the Go API's public routes.
- `DATABASE_URL` configures the Go API and migration executable for local PostgreSQL.
- The PostgreSQL password must be randomly generated and injected as a secret; do not commit `.env` files.
- `AI_MATCHING_ENABLED` stays false unless the feature has completed privacy, security, and institutional review.
- The Python AI service is private; it must not be published directly to the internet.
- EmbeddingGemma 2 loads only from an explicitly mounted local checkpoint. Keep embeddings transient, use only minimized/authorized text, and do not treat similarity as ownership evidence.
- MCP exposes only reviewed public listings and the active institution directory. Its local HTTP transport binds to loopback by default.
- Private claims, contacts, evidence, staff notes, and handover data are not public outputs.
- Local account passwords are bcrypt-hashed. Sign-in sets a `__Host-vp_session` cookie with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` and no `Domain`. PostgreSQL stores only its digest; explicit sign-out, sign-out-all and password reset revoke sessions.
- Email verification and password recovery use single-use tokens; token digests are in PostgreSQL. This phase queues message bodies with raw links in the private local `auth_email_outbox` test sink only. Do not enter real user email addresses or institutional data until an approved email provider, access controls and retention are configured.
- Auth throttles use shared PostgreSQL fixed-window buckets and the direct peer address. If deployed behind a reverse proxy, use a reviewed edge rate limit or explicitly configure trusted proxy handling; do not trust arbitrary `Forwarded`/`X-Forwarded-For` values.
- Cookie-authenticated mutations require an exact allowed `Origin`; set `CORS_ALLOWED_ORIGINS` to the actual browser origins. Serve the app/API over HTTPS in production; the API always marks session cookies `Secure`.

## Docker Compose

The default Compose stack publishes web and API on localhost; PostgreSQL and the AI service remain on a private network. Compose applies SQL migrations before starting the API. Set a generated `POSTGRES_PASSWORD` in the untracked local `.env` file. Demo API fixture reads are disabled by default; private routes fail closed if PostgreSQL is unavailable.

Before any real deployment, complete institution onboarding and approval, privacy/legal review, production email delivery and a recovery runbook, rate-limit behavior behind the selected network edge, least-privilege database access and tenant/RLS review, backups and a restore drill, monitoring and audit trails, secure secret injection, outbox/token retention and deletion rules, incident response, accessibility and an institution-approved pilot. No institution has approved a pilot; demo names and records are fictional.
