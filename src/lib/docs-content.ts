export interface DocumentationSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string;
  links?: { label: string; href: string }[];
}

export interface DocumentationPage {
  title: string;
  eyebrow: string;
  summary: string;
  sections: DocumentationSection[];
}

export const documentationNavigation = [
  { slug: 'architecture', label: 'Architecture' },
  { slug: 'api', label: 'Go API' },
  { slug: 'ai-and-embeddings', label: 'Python AI & embeddings' },
  { slug: 'nextjs', label: 'Next.js applications' },
  { slug: 'mcp', label: 'FastMCP server' },
  { slug: 'security', label: 'Security & access' }
] as const;

export const documentationPages: Record<string, DocumentationPage> = {
  architecture: {
    title: 'A careful, modular foundation',
    eyebrow: 'PLATFORM OVERVIEW',
    summary:
      'A single repository contains the public and authenticated web experiences, documentation, API, matching service, and MCP adapter. The demo uses fictional records and is not an approved institutional pilot.',
    sections: [
      {
        title: 'What lives here',
        paragraphs: [
          'The user-facing areas are routes in one Next.js application. This keeps identity, design tokens, the fixed Supabase palette, Outfit typeface, and Kiranism dashboard shell consistent while keeping each role’s navigation and duties distinct.',
          'The Go API and Python AI service remain first-class services. The optional FastMCP adapter is separate from the API and calls only its public, read-only endpoints.'
        ],
        bullets: [
          'Public landing page: /',
          'Individual experience: /dashboard/search, /dashboard/report, and /dashboard/account',
          'Institution and security staff: /dashboard/cases, /dashboard/claims, and /dashboard/institution',
          'System administration: /dashboard/platform (aggregate operational view)',
          'Developer documentation: /docs, with topic pages under /docs/*',
          'Go API: services/api/',
          'Python AI matching service: services/ai/',
          'FastMCP read-only server: services/mcp/'
        ]
      },
      {
        title: 'Request and trust boundaries',
        paragraphs: [
          'Web pages use the API for product data. Supabase Auth identifies signed-in users; institution membership and platform-admin membership are enforced by the API and database, not by the browser’s preview-role selector.',
          'The AI ranker is a private, optional assistive service called through the Go API. It is not an identity check or decision-maker. The MCP adapter intentionally has no access to private case, claim, or administrative routes.'
        ],
        code: 'Browser → Next.js web app → Go API → PostgreSQL\n                                      └→ private Python ranker (optional)\nMCP client → FastMCP (read-only) → public Go API routes'
      },
      {
        title: 'Run the parts',
        paragraphs: [
          'Follow the root README for the full Compose stack. The MCP server can also run locally over stdio for an MCP client; a local HTTP transport is available for development and should not be exposed as an unauthenticated public endpoint.'
        ],
        code: 'pnpm dev\nmake api-test\nmake ai-test\nmake mcp-test'
      }
    ]
  },
  api: {
    title: 'Go API',
    eyebrow: 'SERVICE REFERENCE',
    summary:
      'The Go service is the authorization and data boundary for public discovery, signed-in user workflows, institution-scoped staff work, and platform aggregates.',
    sections: [
      {
        title: 'Public routes',
        paragraphs: [
          'These endpoints return only active institutions and reviewed, public-safe item summaries.'
        ],
        bullets: [
          'GET /healthz and GET /readyz — process and dependency status.',
          'GET /api/v1/institutions and GET /api/v1/institutions/{institutionID} — active institution directory.',
          'GET /api/v1/items?q={query} and GET /api/v1/items/{itemID} — approved public listings; private evidence and contact details are not part of the response.'
        ],
        code: 'curl "http://localhost:8080/api/v1/items?q=blue%20umbrella"'
      },
      {
        title: 'Authenticated user routes',
        paragraphs: [
          'Send a Supabase access token as a bearer token. Private routes fail closed when authentication or the database is unavailable.'
        ],
        bullets: [
          'POST /api/v1/reports — submit a private report for staff review.',
          'GET /api/v1/me/reports — read the signed-in user’s own reports.',
          'POST /api/v1/me/claims and GET /api/v1/me/claims — create or read the signed-in user’s own claims.'
        ],
        code: 'Authorization: Bearer <supabase-access-token>\nContent-Type: application/json'
      },
      {
        title: 'Institution staff and system admin',
        paragraphs: [
          'Staff routes check active membership for the requested institution. Platform aggregates require an explicit active platform-admin membership. A URL, hidden button, or demo role is never authorization.'
        ],
        bullets: [
          'GET /api/v1/staff/institutions/{institutionID}/cases and /claims — tenant-scoped queues.',
          'PATCH /api/v1/staff/institutions/{institutionID}/cases/{caseID} — update authorized case status.',
          'POST /api/v1/staff/institutions/{institutionID}/claims/{claimID}/review — record a human review.',
          'POST /api/v1/staff/institutions/{institutionID}/items/{itemID}/review — review a report before publication.',
          'POST /api/v1/staff/institutions/{institutionID}/cases/{caseID}/handover — staff-coordinated return event.',
          'GET /api/v1/institutions/{institutionID}/stats and GET /api/v1/platform/stats — role-checked aggregates.',
          'POST /api/v1/staff/institutions/{institutionID}/matches/suggest — private, institution-scoped suggestions; matching is disabled by default.'
        ]
      },
      {
        title: 'Response and safety conventions',
        paragraphs: [
          'Successful responses wrap values in a data object. Errors use {"error":{"code":"...","message":"..."}}. Keep request bodies, bearer tokens, contact details, claims, withheld clues, and evidence references out of logs and public descriptions.'
        ],
        links: [
          {
            label: 'Go service README and endpoint notes',
            href: 'https://github.com/troubleman96/vilivyopoteanakupatikana-new/tree/monorepo/services/api'
          }
        ]
      }
    ]
  },
  'ai-and-embeddings': {
    title: 'AI suggestions and embeddings',
    eyebrow: 'PYTHON AI SERVICE',
    summary:
      'The current matching implementation is a deterministic lexical heuristic. Embeddings and EmbeddingGemma are documented as a possible future evaluation—not as an active model or dependency in this repository.',
    sections: [
      {
        title: 'What runs today',
        paragraphs: [
          'services/ai/ is a private FastAPI service that ranks up to 50 candidate records using lexical, category, date, and location signals. Its score is an uncalibrated ordering heuristic, not a probability or confidence that two records refer to the same object.',
          'The current service does not load or download a model checkpoint, create embeddings, use a vector database, call an external AI provider, inspect images, or make an ownership decision. The integration flag AI_MATCHING_ENABLED defaults to false.'
        ],
        code: 'Go API (authorized staff request)\n  → private Python ranker (optional)\n  → ranked suggestions + neutral overlap reasons\n  → staff independently verify; human review remains authoritative'
      },
      {
        title: 'Embeddings, in brief',
        paragraphs: [
          'An embedding is a numeric vector produced from content. A retrieval system can compare vectors—often with cosine similarity—to find semantically related text even when the wording differs. Similarity is a retrieval signal, not proof, calibrated confidence, or a decision.',
          'Google’s EmbeddingGemma family is one potential model family to evaluate for embedding workloads. No EmbeddingGemma weights, model calls, generated vectors, or model-specific runtime are present here. Review the exact model version, terms, operational footprint, and language performance before considering adoption.'
        ],
        links: [
          {
            label: 'Google AI: EmbeddingGemma documentation',
            href: 'https://ai.google.dev/gemma/docs/embeddinggemma'
          }
        ]
      },
      {
        title: 'Requirements before any embedding rollout',
        paragraphs: [
          'Do not turn on a future embedding path by changing a UI setting alone. It would require a separate privacy, security, institutional, and operational review.'
        ],
        bullets: [
          'Obtain institutional approval and document an authorized purpose before using real records.',
          'Minimize and redact inputs; never embed contacts, account identifiers, private claims, evidence, or withheld verification clues.',
          'Keep retrieval tenant-scoped and enforce institution isolation in the backend and data store.',
          'Keep matching opt-in and off by default; monitor access, retention, deletion, and model/version changes.',
          'Evaluate false matches, language and category performance, score calibration, and human factors using approved data.',
          'Present suggestions as leads only; people independently verify every claim and handover.'
        ]
      }
    ]
  },
  nextjs: {
    title: 'Next.js application areas',
    eyebrow: 'WEB APP & DEVELOPER SITE',
    summary:
      'The public product and developer portal share one Next.js App Router application. Their routes are experiences, not independent authorization domains.',
    sections: [
      {
        title: 'Product experiences',
        bullets: [
          'Landing page — src/app/page.tsx and the public product story at /. ',
          'Individual user app — public search, local demo reporting, and account views under /dashboard.',
          'Institution and security staff — case queue, claim review, and institution overview routes.',
          'System admin — /dashboard/platform, intended for platform-level operational aggregates.',
          'Documentation site — /docs and /docs/{architecture,api,ai-and-embeddings,nextjs,mcp,security}.'
        ],
        paragraphs: [
          'The dashboard keeps the existing Kiranism shell, fixed Supabase palette, Outfit font, and role-preview selector. The selector is for fictional demo exploration only; it is not an authentication or access-control mechanism.'
        ]
      },
      {
        title: 'Implementation conventions',
        bullets: [
          'App Router pages are server components by default; use client components only for interactive UI.',
          'Keep feature data behind service/query layers and send product operations through the Go API.',
          'Use the shared design tokens and components rather than creating a parallel theme.',
          'Keep public item projections redacted and avoid storing private claims or contact details in browser demo state.',
          'Preserve the fixed typeface, fixed Supabase palette, and Kiranism dashboard shell when extending the UI.'
        ],
        code: 'src/app/                 Next.js App Router routes\nsrc/components/vilivyopotea/  product views and documentation shell\nsrc/features/             reusable feature modules\nsrc/lib/                  API clients, demo data, and docs content'
      },
      {
        title: 'Useful commands',
        code: 'pnpm dev\npnpm typecheck\nmake web-build\nmake web-lint'
      }
    ]
  },
  mcp: {
    title: 'FastMCP server',
    eyebrow: 'READ-ONLY MCP ADAPTER',
    summary:
      'A Python FastMCP server makes the public discovery API available to MCP-compatible clients. It deliberately does not expose private user, staff, or system-admin actions.',
    sections: [
      {
        title: 'Available capabilities',
        bullets: [
          'search_public_listings(query, limit) — find reviewed public-safe listings using a bounded, PII-rejecting query.',
          'get_public_listing(item_id) — retrieve one reviewed public listing by its public identifier.',
          'list_active_institutions() — list the public institution directory.',
          'vilivyopotea://safe-use — a resource describing privacy and human-review boundaries.'
        ],
        paragraphs: [
          'Every tool calls a public GET route in the Go API and projects only public response fields. There are no report, claim, evidence, review, handover, staff queue, or platform-admin tools.'
        ]
      },
      {
        title: 'Run locally over stdio',
        paragraphs: [
          'Install the isolated Python dependencies, then point your MCP client at services/mcp/server.py. Stdio is the default transport and keeps the service local to the client process.'
        ],
        code: 'python3 -m venv services/mcp/.venv\nservices/mcp/.venv/bin/pip install -r services/mcp/requirements.txt\nVILIVY_API_BASE_URL=http://localhost:8080/api/v1 \\\n  services/mcp/.venv/bin/python services/mcp/server.py'
      },
      {
        title: 'Local HTTP development',
        paragraphs: [
          'For local-only testing, set MCP_TRANSPORT=http. The default bind address is 127.0.0.1. Keep it loopback-bound unless you add and verify authentication, network policy, rate limits, and monitoring for a trusted deployment.'
        ],
        code: 'MCP_TRANSPORT=http MCP_HOST=127.0.0.1 MCP_PORT=8100 \\\n  VILIVY_API_BASE_URL=http://localhost:8080/api/v1 \\\n  python services/mcp/server.py\n# Streamable HTTP endpoint: http://127.0.0.1:8100/mcp'
      }
    ]
  },
  security: {
    title: 'Identity, tenant isolation, and review',
    eyebrow: 'SECURITY MODEL',
    summary:
      'The design separates public discovery from private claims and staff operations. Real authorization is enforced server-side and in the data model; a front-end role picker never grants access.',
    sections: [
      {
        title: 'Identity and authorization',
        bullets: [
          'Supabase Auth validates bearer access tokens; the client uses only public/anon configuration.',
          'Institution staff routes check active membership for the specific institution on each request.',
          'System-wide aggregates require explicit active platform-admin membership.',
          'Private user routes are scoped to the authenticated identity.',
          'Supabase credentials remain unconfigured in this project; private operations fail closed until a real environment is configured.'
        ]
      },
      {
        title: 'Information boundaries',
        bullets: [
          'Only reviewed public-safe item summaries are searchable without authentication.',
          'Claims, contact details, evidence references, withheld identifiers, and staff notes are private.',
          'Do not put phone numbers, student IDs, serial numbers, home addresses, or unique proof in public descriptions.',
          'The MCP server mirrors the public boundary and has no tool for private data or mutations.'
        ]
      },
      {
        title: 'Human authority and rollout status',
        paragraphs: [
          'Staff independently verify ownership and coordinate returns. AI suggestions never approve or reject a claim. Institution names and example records are synthetic; DIT is only a proposed pilot and has not approved a pilot.',
          'This repository is a pre-pilot foundation, not permission to collect personal data or launch. Complete institutional approval, privacy and security review, retention design, abuse response, accessibility, and operational readiness before any real deployment.'
        ]
      }
    ]
  }
};
