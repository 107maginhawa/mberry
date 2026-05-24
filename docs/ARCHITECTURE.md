# Architecture

> Living document derived from the [Codebase Adoption Audit](./audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md) (2026-05-08).
> Update when structure changes.

---

## Monorepo Structure

```
memberry/
├── apps/
│   ├── admin/            # Platform ops dashboard (port 3003)
│   └── memberry/         # Product app — membership, dues, events, training, auth, profile, settings (port 3004)
├── services/
│   └── api-ts/           # Reference Hono + Drizzle API
├── specs/
│   └── api/              # TypeSpec definitions → OpenAPI → TS types (@monobase/api-spec)
│       └── tests/contract/  # Hurl contract suite (27 scenarios, 44 files)
├── packages/
│   ├── eslint-config/    # Shared ESLint flat configs (base, react, next)
│   ├── sdk-ts/           # Generated TanStack Query hooks + hand-written client/flows/utils
│   ├── typescript-config/ # Shared tsconfig presets
│   └── ui/               # Shared UI package
├── scripts/              # Utility scripts (run-contract-tests.ts, etc.)
├── docs/                 # Documentation and audits
└── .github/workflows/    # CI: contract tests, Schemathesis
```

---

## Application Ports

| App | Port | Location | Purpose |
|-----|------|----------|---------|
| api-ts | 7213 | `services/api-ts/` | Hono + Drizzle backend API |
| admin | 3003 | `apps/admin/` | Platform ops dashboard |
| memberry | 3004 | `apps/memberry/` | Product app (includes auth, profile, settings) |

Ports are configured in each app's `vite.config.ts` and `services/api-ts/src/core/config.ts` (`SERVER_PORT` env, default 7213).

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Bun | 1.2.21 |
| Frontend framework | React | 19.1.1 |
| Backend framework | Hono | 4.0.0 |
| Database | PostgreSQL | 16 |
| ORM | Drizzle | 0.44.6 |
| Router (frontend) | TanStack Router | latest |
| Data fetching | TanStack Query | latest |
| Auth | Better-Auth | 1.3.27 |
| Bundler | Vite | 7.1.4 |
| Validation | Zod | 4.1.12 |
| API spec | TypeSpec | latest |
| UI components | shadcn/ui (Radix primitives) | latest |

---

## Deployment Topology

```
┌─────────────────────────────────────────────────────┐
│                    Frontend Apps                      │
│            admin (:3003)  memberry (:3004)            │
│         Vite dev server + proxy → /api → :7213       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (proxy strips /api prefix)
┌──────────────────────▼──────────────────────────────┐
│                  api-ts (:7213)                       │
│               Bun + Hono runtime                     │
└───┬──────┬──────┬──────┬──────┬──────┬──────────────┘
    │      │      │      │      │      │
    ▼      ▼      ▼      ▼      ▼      ▼
  Postgres S3/   Stripe Postmark OneSignal pg-boss
   :5432  MinIO  (Connect) (email) (push)  (jobs)
          :9000
```

### Docker Dev Dependencies (`services/api-ts/docker-compose.deps.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Primary database |
| minio | minio/minio:latest | 9000, 9001 | S3-compatible file storage |
| mailpit | axllent/mailpit:latest | 1025 (SMTP), 8025 (UI) | Email capture for dev |
| stripe-mock | stripe/stripe-mock:latest | 12111 | Stripe API mock |

### External Integrations (Production)

| Service | Purpose | Config Source | Status |
|---------|---------|--------------|--------|
| Stripe Connect | Billing, payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Integrated |
| OneSignal | Push notifications | `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` | Integrated |
| S3/MinIO | File storage | Storage config in `core/storage.ts` | Integrated |
| Postmark | Transactional email | `POSTMARK_API_KEY`, `POSTMARK_MESSAGE_STREAM` | Integrated |
| pg-boss | Background job queue | Uses same PostgreSQL connection | Integrated |
| WebRTC | Video calls | `WEBRTC_ICE_SERVERS` | Scaffolded (infra-ready) |

---

## Request Flow

```
Browser → Vite proxy (/api/* → /*) → Hono → Middleware stack → Handler → Drizzle ORM → PostgreSQL
```

### Vite Proxy

Each frontend app proxies `/api/*` to `http://localhost:7213`, stripping the `/api` prefix:

```typescript
// apps/admin/vite.config.ts, apps/memberry/vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:7213',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

Frontend calls `fetch('/api/persons/me')` → proxy rewrites to `GET /persons/me` → Hono handler.

---

## Middleware Stack

10 middleware layers applied in order on every request. Registered in `services/api-ts/src/app.ts`:

```
requestId → DI → audit → requestLogger → securityHeaders → CORS → auth → platformAdmin → officerAuth → orgContext
```

| # | Middleware | File | Purpose |
|---|-----------|------|---------|
| 1 | requestId | `src/middleware/request.ts` | UUID per request for tracing |
| 2 | DI | `src/middleware/dependency.ts` | Inject logger, DB, storage, auth, jobs |
| 3 | audit | `src/middleware/audit.ts` | After-middleware: log write ops (POST/PUT/PATCH/DELETE) to `audit_log_entries` |
| 4 | requestLogger | `src/middleware/request.ts` | Pino structured logging with correlation IDs |
| 5 | securityHeaders | `src/middleware/security.ts` | Standard security headers |
| 6 | CORS | `src/middleware/security.ts` | Cross-origin configuration |
| 7 | auth | `src/core/auth.ts` | Better-Auth session extraction + validation |
| 8 | platformAdmin | `src/middleware/platform-admin-auth.ts` | DB lookup in `platform_admins` table for `/admin/*` |
| 9 | officerAuth | `src/middleware/officer-auth.ts` | Position-based access control (64+ uses across handlers) |
| 10 | orgContext | `src/middleware/org-context.ts` | Organization scoping from `x-org-id` header |

Auth plugins: emailOTP, admin, bearer, twoFactor, magicLink, apiKey, passkey.

Internal bypass: `X-Internal-Service-Token` header for service-to-service calls.

---

## Data Flow: Spec → Code Generation

```
TypeSpec definitions          →  OpenAPI spec              →  Code generation
specs/api/src/modules/*.tsp      specs/api/dist/openapi/      services/api-ts/src/generated/
                                 openapi.json                 ├── openapi/     (routes, validators, registry)
                                                              ├── better-auth/ (auth schema, specs)
                                                              ├── migrations/  (DB migrations)
                                                              └── websocket/   (WS registry)
                                                              
                                 Also generates:
                                 packages/sdk-ts/             (TanStack Query hooks, TS types)
```

### Pipeline Commands

```bash
cd specs/api && bun run build           # TypeSpec → OpenAPI + TS types
cd services/api-ts && bun run generate  # OpenAPI → routes, validators, handler stubs
```

### Generated vs Hand-Written Boundaries

| Generated (DO NOT EDIT) | Hand-Written (edit these) |
|--------------------------|--------------------------|
| `services/api-ts/src/generated/openapi/*` — routes, validators, registry | `services/api-ts/src/handlers/*/` — handler implementations |
| `services/api-ts/src/generated/better-auth/*` — auth schema/specs | `services/api-ts/src/handlers/*/repos/*.schema.ts` — DB schemas |
| `services/api-ts/src/generated/migrations/*` — DB migrations | `services/api-ts/src/middleware/` — middleware |
| `services/api-ts/src/generated/websocket/*` — WS registry | `services/api-ts/src/core/` — core services |
| `specs/api/dist/` — compiled OpenAPI | `specs/api/src/modules/*.tsp` — TypeSpec source |
| `packages/sdk-ts/` — generated hooks + types | `services/api-ts/src/app.ts` — route registration |

---

## Handler Modules (22 directories)

Located at `services/api-ts/src/handlers/`. Each follows: **Router → Validators → Handlers → Repositories**.

| Category | Module | TypeSpec | Notes |
|----------|--------|----------|-------|
| **Core identity** | `person` | Yes | Central PII hub (25 handlers) |
| **Association** | `association:member` | Yes | Mega-module: membership, chapters, officers, positions (157 handlers) |
| | `association:operations` | Yes | Analytics, cross-chapter rollups (54 handlers) |
| **Platform** | `platformadmin` | Yes | Admin-tier operations (21 handlers) |
| **Membership** | `membership` | No | Applications, approvals, tiers (12 handlers) |
| | `dues` | No | Invoicing, payments, funds (15 handlers) |
| | `invite` | Yes | Org invitations (3 handlers) |
| **Billing** | `billing` | Yes | Stripe Connect integration (16 handlers) |
| **Events/Training** | `booking` | Yes | Time-based scheduling (19 handlers) |
| | `events` | Yes | Event management (11 handlers) |
| | `training` | No | CPD/CE credit tracking (10 handlers) |
| | `elections` | Yes | Voting and nominations (6 handlers) |
| **Communications** | `communication` | Yes | Templates, queuing (28 handlers) |
| | `communications` | No | Announcements (8 handlers) |
| | `comms` | Yes | WebSocket: video, chat (11 handlers) |
| **Content** | `documents` | Yes | Document management + access-log tracking (15 handlers) |
| | `certificates` | Yes | Certificate generation (3 handlers) |
| | `storage` | Yes | File upload/download via S3/MinIO (6 handlers) |
| | `reviews` | Yes | NPS review system (4 handlers) |
| **Compliance** | `audit` | Yes | Compliance logging (1 handler) |
| | `email` | Yes | Transactional email queue (9 handlers) |
| | `notifs` | Yes | Multi-channel notifications via OneSignal (5 handlers) |

~60% have TypeSpec coverage. Three comms modules overlap and need consolidation.

---

## Error Handling

Centralized in `services/api-ts/src/core/errors.ts`. All extend `AppError`:

- `UnauthorizedError`, `ForbiddenError`, `AuthenticationError`, `AuthorizationError`
- `ValidationError`, `BadRequestError`, `NotFoundError`, `ConflictError`
- `RateLimitError`, `TimeoutError`, `ExternalServiceError`
- `BusinessLogicError`, `DeferredScopeError`
- `HipaaComplianceError`

Security-filtered in production. Consistent JSON format: `{ requestId, timestamp, error, code }`.

---

## Testing Stack

| Framework | Purpose | Location | Run Command |
|-----------|---------|----------|-------------|
| Bun test | Backend unit + integration | `services/api-ts/src/**/*.test.ts` | `cd services/api-ts && bun test` |
| Vitest | Frontend unit (configured, sparse) | `apps/*/src/**/*.test.*` | `cd apps/{app} && bun run test` |
| Playwright | E2E tests | `apps/*/tests/e2e/` | `cd apps/{app} && bun run test:e2e` |
| Hurl + Schemathesis | Contract tests | `specs/api/tests/contract/` | `bun run scripts/run-contract-tests.ts` |

---

