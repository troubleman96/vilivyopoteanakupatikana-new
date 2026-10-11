# Platform administration

Standalone Next.js app for platform administrators at `http://localhost:3003`.

Run from the repository root with `pnpm admin:dev`; build with `pnpm admin:build`. It shares the product app's local PostgreSQL session and Go API. Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_PRODUCT_APP_URL` for another environment, and add this app's exact origin to `CORS_ALLOWED_ORIGINS`.

The API requires an active `platform_admins` row and checks it on every request. The console manages institutions, registered-account memberships, platform administrators and audit history. Bootstrap the first administrator through the protected database owner connection; after that, manage access in this app. Use synthetic pre-pilot data only.
