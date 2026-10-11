# Deployment

This repository is a pre-pilot product monorepo, not the unmodified dashboard starter. The root Next.js application serves the public landing page, individual workspace, institution/security-staff workspace, system-admin preview, and the developer docs site at `/docs`. The Go API, private Python matching service, and optional FastMCP adapter are separate services.

## Web application

The Next.js app can deploy to Vercel or anywhere Docker runs. `next.config.ts` enables standalone output when `BUILD_STANDALONE=true`. Configure its public API URL and Supabase browser values as build-time environment variables. Do not put a service-role key in a `NEXT_PUBLIC_*` variable.

For other platforms, see the [Next.js deployment docs](https://nextjs.org/docs/app/getting-started/deploying).

## Environment and trust boundaries

- `NEXT_PUBLIC_API_BASE_URL` points the browser to the Go API's public routes.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configure browser sign-in; server-side validation also requires `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- `AI_MATCHING_ENABLED` stays false unless the feature has completed the necessary privacy, security, and institutional review.
- The Python AI service is private; it must not be published directly to the internet.
- EmbeddingGemma 2 loads only from an explicitly mounted local checkpoint. Keep embeddings transient, use only minimized/authorized text, and do not treat similarity as ownership evidence.
- MCP exposes only reviewed public listings and the active institution directory. Its local HTTP transport binds to loopback by default. Add authentication, network policy, rate limits, and monitoring before any remote deployment.
- Private claims, contacts, evidence, staff notes, and handover data are not public outputs.
- Supabase credentials are unconfigured in the repository. Private operations fail closed until the deployment supplies valid configuration.

## Docker Compose

The default Compose stack publishes only web and API on localhost; PostgreSQL and the AI service are on a private network. The optional MCP profile also runs on that internal network and publishes no host port:

```bash
docker compose --profile mcp up --build mcp
```

For an MCP client running on a developer computer, use the service's default stdio transport rather than publishing the Compose endpoint. See [the MCP developer guide](/docs/mcp).

### Local EmbeddingGemma 2 test

For a local Compose test, set `EMBEDDINGGEMMA_MODEL_DIR` to the existing checkpoint directory and layer the optional override onto the regular stack:

```bash
EMBEDDINGGEMMA_MODEL_DIR=/absolute/path/to/embeddinggemma-2-google \
  docker compose -f compose.yaml -f compose.embeddinggemma.yaml up --build ai
```

The override mounts model files read-only at `/models/embeddinggemma-2-google`; it publishes no AI host port. The Python service reports the active ranker at `/readyz`. The standard Compose setup remains usable without a checkpoint and uses its deterministic fallback. See [the AI service guide](../services/ai/README.md) for a standalone synthetic request test.

Before production deployment, configure HTTPS at the edge, Supabase, least-privilege database access, tenant isolation, backups, monitoring, rate limiting, audit trails, secure secret injection, retention and deletion policies, incident response, and institution-approved operational procedures. No institution has approved a pilot; demo names and records are fictional.
