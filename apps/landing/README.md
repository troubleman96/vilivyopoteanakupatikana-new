# Marketing site

Standalone Next.js marketing app for Vilivyopotea na Kupatikana. It shares the repository's product framing and Lagoon visual language, while the product app remains at the repository root.

From the repository root:

```bash
pnpm landing:dev
pnpm landing:build
pnpm landing:start
```

The local marketing URL is `http://localhost:3001`; the product app is `http://localhost:3000`. Set `NEXT_PUBLIC_PRODUCT_APP_URL` to point its calls to action at the product app. The product app links back using `NEXT_PUBLIC_LANDING_URL`.

The site describes a pre-pilot concept only. It uses fictional records and does not imply institutional approval or endorsement.
