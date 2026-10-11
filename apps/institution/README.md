# Institution workspace

Standalone Next.js app for institution and security staff at `http://localhost:3004` (port 3002 is already used by another local service in this workspace).

Run from the repository root with `pnpm institution:dev`; build with `pnpm institution:build`. It uses the product app's local PostgreSQL session and Go API. Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_PRODUCT_APP_URL` for another environment. Add this app's exact origin to the API's `CORS_ALLOWED_ORIGINS`.

The API verifies institution membership for every private operation. The app includes institution-scoped case queues, public-safe item review, claim review and verification, and verified return handover. Synthetic pre-pilot data only; institutional approval is not implied.
