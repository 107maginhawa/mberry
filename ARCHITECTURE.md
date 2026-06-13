# Architecture Guide

## Purpose

This document explains how this application is technically structured and how new modules and vertical slices should be implemented.

This is the **technical source of truth** for the repo. For other concerns:
- **[README.md](./README.md)** — project overview, installation, commands
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development workflow, coding standards, PR process
- **[CLAUDE.md](./CLAUDE.md)** — AI-specific instructions for Claude Code
- **[specs/api/CONTRACT.md](./specs/api/CONTRACT.md)** — wire-level API contract
- **[specs/api/IMPLEMENTING.md](./specs/api/IMPLEMENTING.md)** — playbook for adding a new server impl or client SDK

## Architecture Philosophy

**Spec-first, polyglot-ready monorepo.** The OpenAPI document at `specs/api/dist/openapi/openapi.json` is the single source of truth. Every server implementation and client SDK is generated from it.

**Vertical slices over horizontal layers.** New features are built end-to-end (TypeSpec → handler → frontend → tests) rather than building all APIs first, then all frontend.

**Convention over configuration.** Module structure, naming, error handling, and testing patterns are standardized. Follow the exemplars.

## Tech Stack

```
Frontend:       Vite, React 19, TanStack Router, TanStack Query, TypeScript
UI:             Radix UI primitives (shadcn/ui patterns), Tailwind CSS
Backend:        Hono (HTTP framework), Bun runtime
Database:       PostgreSQL 16, Drizzle ORM
Validation:     Zod (auto-generated from TypeSpec via @hono/zod-validator)
Auth:           Better-Auth
API Spec:       TypeSpec → OpenAPI 3.0
SDK:            @monobase/sdk-ts (auto-generated via @hey-api/openapi-ts)
Testing:        Bun test (unit/integration), Playwright (E2E), Hurl + Schemathesis (contract/fuzz)
Package Mgr:    Bun workspaces
```

## Repository Structure

```
monobase/
├── apps/
│   ├── admin/                # Platform ops dashboard [port 3003]
│   └── memberry/             # Product app (membership, dues, events, auth, profile, settings) [port 3004]
├── packages/
│   ├── eslint-config/        # Shared ESLint flat configs
│   ├── sdk-ts/               # Generated TS client SDK + TanStack Query hooks
│   └── typescript-config/    # Shared TS configs
├── services/
│   └── api-ts/               # Reference Hono + Drizzle API implementation
├── specs/
│   └── api/                  # TypeSpec sources, OpenAPI output, contract tests
│       ├── src/modules/      # TypeSpec definitions per module
│       ├── dist/             # Generated OpenAPI + TS types
│       └── tests/contract/   # Hurl contract test scenarios
├── docs/
│   ├── templates/            # PRD, module spec, slice spec, test plan templates
│   └── checklists/           # Vertical slice, TDD, QA review checklists
└── scripts/                  # Build and test utilities
```

## Module Structure

Each handler module lives in `services/api-ts/src/handlers/<module>/` and contains:

```
handlers/<module>/
├── createEntity.ts           # Handler: create
├── getEntity.ts              # Handler: read
├── updateEntity.ts           # Handler: update
├── deleteEntity.ts           # Handler: delete
├── listEntities.ts           # Handler: list (paginated)
├── repos/
│   ├── entity.schema.ts      # Drizzle schema definition
│   └── entity.repo.ts        # Repository (extends DatabaseRepository)
├── jobs/                     # Background job definitions (optional)
└── utils/                    # Module-specific utilities (optional)
```

## Vertical Slice Structure

A vertical slice is one complete workflow implemented end-to-end. Two variants:

### Full-Stack Slice (user-facing features)
- TypeSpec API definition
- Generated routes, validators, types
- Handler implementation
- Frontend route/component
- Client + server validation
- Permission checks
- Tests (unit, integration, contract)

### Backend-Only Slice (webhooks, jobs, notifications)
- TypeSpec API definition (if external-facing)
- Handler implementation
- Job/webhook processing
- Tests

### Before/After: Implementation Order

**Before (horizontal — how existing modules were built):**
Built all person handlers, then all booking handlers, then all billing handlers.

**After (vertical — how new features should be built):**
Build `create-appointment` end-to-end (TypeSpec → handler → frontend → tests) before starting `update-appointment`.

## Data Flow

```
TypeSpec → OpenAPI → Generated Routes/Validators → Handler Implementations → Repositories → PostgreSQL
                  → Generated SDK (sdk-ts) → TanStack Query hooks → React Components
```

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

## Middleware Stack

Global middleware applied in order on every request. Registered in `services/api-ts/src/app.ts` (search "Global middleware - order matters!"):

| # | Middleware | File | Purpose |
|---|-----------|------|---------|
| 1 | requestId | `src/middleware/request.ts` | UUID per request for tracing |
| 2 | tracing | `src/core/observability.ts` | OpenTelemetry server span per request; no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` unset |
| 3 | DI | `src/middleware/dependency.ts` | Inject logger, DB, storage, auth, jobs |
| 4 | audit | `src/middleware/audit.ts` | After-middleware: log write ops (POST/PUT/PATCH/DELETE) to `audit_log_entries` |
| 5 | requestLogger | `src/middleware/request.ts` | Pino structured logging with correlation IDs |
| 6 | securityHeaders | `src/middleware/security.ts` | Standard security headers |
| 7 | CORS | `src/middleware/security.ts` | Cross-origin configuration |
| 8 | CSRF origin check | Hono `csrf()` | Blocks cross-origin state-changing requests (same origins as CORS) |
| 9 | CSRF double-submit token | `src/middleware/csrf-token.ts` | `x-csrf-token` header must mirror same-origin cookie; allowlists `/webhooks/`, `/email/unsubscribe`, `/pay/`, `/auth/`, `/test/` |
| 10 | bodyLimit | Hono `bodyLimit()` | 1MB global; 10MB on `/storage/*` and `/documents/*` |
| 11 | rateLimiter | `src/middleware/rate-limit.ts` | Global rate limiting for custom endpoints (auth routes handled by Better-Auth) |
| 12 | impersonation guard | `src/middleware/impersonation-guard.ts` | Resolve impersonation cookie → context, then block writes while impersonating |
| 13 | metrics | `src/core/metrics.ts` | Request metrics |

Auth is **scoped, not global**: `authMiddleware` + `platformAdminAuthMiddleware` on `/admin/*`; `authMiddleware` + `orgContextMiddleware` on `/email/*` and association routes (with explicit public-path exceptions); officer/position checks emitted per-route by the generator from `x-require-officer` / `x-require-position` TypeSpec extensions.

Auth plugins: emailOTP, admin, bearer, twoFactor, magicLink, apiKey, passkey.

Internal bypass: `X-Internal-Service-Token` header for service-to-service calls.

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

### Docker Dev Dependencies (`docker-compose.yml` at repo root)

Brought up via `bun infra:up` (orchestrated by Turborepo / root scripts).

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Primary database |
| minio | minio/minio:latest | 9000, 9001 | S3-compatible file storage |
| createbuckets | minio/mc:latest | (init) | Auto-creates STORAGE_BUCKET on first start |
| mailpit | axllent/mailpit:latest | 1025 (SMTP), 8025 (UI) | Email capture for dev |
| stripe-mock | stripe/stripe-mock:latest | 12111 | Stripe API mock |
| loki | grafana/loki:3.3.2 | 3100 | Log aggregation backend |
| grafana | grafana/grafana:11.4.0 | 3030 | Log/metric visualization (pre-provisioned Loki + API dashboard) |

### External Integrations (Production)

| Service | Purpose | Config Source | Status |
|---------|---------|--------------|--------|
| Stripe Connect | Billing, payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Integrated |
| OneSignal | Push notifications | `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` | Integrated |
| S3/MinIO | File storage | Storage config in `core/storage.ts` | Integrated |
| Postmark | Transactional email | `POSTMARK_API_KEY`, `POSTMARK_MESSAGE_STREAM` | Integrated |
| pg-boss | Background job queue | Uses same PostgreSQL connection | Integrated |
| WebRTC | Video calls | `WEBRTC_ICE_SERVERS` | Scaffolded (infra-ready) |

## Handler Pattern

The actual implementation pattern (NOT "Router → Validators → Service → Handlers"):

1. **Routes** are auto-generated in `src/generated/openapi/routes.ts` and **validators** (Zod schemas) in `src/generated/openapi/validators.ts`. Never edit these.
2. **Handler functions** are the business logic layer. Each receives a `ValidatedContext<TBody>` and accesses dependencies via `ctx.get()`:
   - `ctx.get('database')` — Drizzle database instance
   - `ctx.get('logger')` — Pino logger
   - `ctx.get('user')` or `ctx.get('session')` — authenticated user/session
   - `ctx.get('audit')` — audit logger
   - `ctx.req.valid('json')` — validated request body (typed by generated validators)
3. **Repositories** extend `DatabaseRepository` from `@/core/database.repo`, which provides `createOne`, `findOneById`, `findOne`, `updateOneById`, `deleteOneById`, `findMany`, `findManyWithPagination`. Subclasses implement `buildWhereConditions` for entity-specific filtering, and may add domain-specific helpers (e.g. `reviewExists`, `findOneWithLineItems`).

## API Pattern

Every endpoint uses the same request/response flow:

1. Request → generated Zod validator (input shape enforced)
2. Validated body → handler function (typed `ctx.req.valid('json')`)
3. Handler → repository methods → Drizzle query → PostgreSQL
4. Response → typed JSON body (shape matches TypeSpec definition)

## Validation Pattern

- **Server-side**: Zod validators auto-generated from TypeSpec. Applied by `@hono/zod-validator` middleware in generated routes. Server-side validation is always authoritative.
- **Client-side**: Optional, for UX. Never rely on client-side validation alone.
- **Error format**: Validation errors return 400 with `fieldErrors` (per-field) and `globalErrors` arrays. See Error Handling below.

## Authentication and Authorization

- **Better-Auth** provides session-based authentication (cookie + bearer token).
- **Middleware stack**: `authMiddleware` validates session → `requireRole('admin')` checks permissions.
- Roles are stored on the user record. Role checks use string matching (`user.role.includes('admin')`).
- **No API key auth** — session-only for now.

## Consent Model

Consent management is planned but **not yet implemented** in the database schema. No JSONB consent fields exist on the Person model currently. See audit docs for current Person table structure.

## Error Handling

Full error hierarchy in `services/api-ts/src/core/errors.ts`:

| Error Class | HTTP Status | Code | When to Use |
|---|---|---|---|
| `AppError` | 500 | `INTERNAL_ERROR` | Base class; unexpected errors |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Missing/invalid auth |
| `ForbiddenError` | 403 | `FORBIDDEN` | Authenticated but insufficient role |
| `ValidationError` | 400 | `VALIDATION_ERROR` | Input fails validation |
| `BusinessLogicError` | 422 | `BUSINESS_ERROR` | Business rule violation |
| `ConflictError` | 409 | `CONFLICT` | Duplicate or state conflict |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `RateLimitError` | 429 | `RATE_LIMIT` | Too many requests (sets `Retry-After` header) |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` | Auth mechanism failure (includes scheme info) |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` | Permission failure (includes required/actual permissions) |
| `TimeoutError` | 408 | `TIMEOUT_ERROR` | Operation timed out |
| `ExternalServiceError` | 503 | `EXTERNAL_SERVICE_ERROR` | Third-party service failure |
| `InternalError` | 500 | `INTERNAL_ERROR` | Internal server error with context |
| `DeferredScopeError` | 501 | `DEFERRED_SCOPE` | Handler stub for features deferred to future scope |

**Multiple response shapes**: Different error types return different response bodies. `RateLimitError` includes `limit`/`usage`/`resetTime`. `AuthenticationError` includes `scheme`/`supportedSchemes`. `NotFoundError` includes `resourceType`/`suggestions`. Zod validation errors include `fieldErrors`/`globalErrors`. Do not assume a single "standard" error shape.

## Testing Architecture

| Type | Tool | Command | When |
|---|---|---|---|
| Unit/Integration | Bun test | `cd services/api-ts && bun test` | Business logic, repos, utils |
| E2E | Playwright | `cd apps/memberry && bun run test:e2e` | Critical user flows |
| Contract | Hurl | `bun run test:contract` | API shape compliance |
| Fuzz | Schemathesis | `bun run test:contract:fuzz` | Spec/impl drift detection |

**Testing priority** (what to test first):
1. Business rules
2. Validation (valid + invalid inputs)
3. Permissions (authorized + unauthorized)
4. State transitions
5. API contracts
6. Critical user flows
7. Error handling

**Contract tests are first-class quality gates.** Every API change must pass the Hurl suite before merge.

## Generated vs Hand-Written Boundary

| Path | Generated? | Action |
|---|---|---|
| `services/api-ts/src/generated/openapi/*` | Yes — NEVER EDIT | Regenerate: `cd services/api-ts && bun run generate` |
| `services/api-ts/src/generated/better-auth/*` | Yes — NEVER EDIT | Auth schema auto-generated |
| `services/api-ts/src/generated/migrations/*` | Yes — NEVER EDIT | Generate: `cd services/api-ts && bun run db:generate` |
| `specs/api/dist/*` | Yes — NEVER EDIT | Regenerate: `cd specs/api && bun run build` |
| `packages/sdk-ts/src/generated/*` | Yes — NEVER EDIT | Regenerate: `cd packages/sdk-ts && bun run build` |
| `specs/api/src/modules/*.tsp` | Hand-written | TypeSpec API definitions |
| `services/api-ts/src/handlers/**/*.ts` | Hand-written | Handler business logic |
| `services/api-ts/src/handlers/**/repos/*.schema.ts` | Hand-written | Drizzle database schemas |

## Code Generation Pipeline

Full flow when making API changes:

```bash
# 1. Edit TypeSpec definitions
#    specs/api/src/modules/<module>.tsp

# 2. Generate OpenAPI + TS types
cd specs/api && bun run build

# 3. Generate routes, validators, handler stubs
cd ../../services/api-ts && bun run generate

# 4. Implement handler business logic
#    services/api-ts/src/handlers/<module>/<operation>.ts

# 5. Regenerate SDK (if API changed)
cd ../../packages/sdk-ts && bun run build

# 6. Run contract tests
bun run test:contract

# 7. Run unit tests
cd services/api-ts && bun test
```

## How to Add a New Module

1. Read or write the module spec (use `docs/quality/MODULE_SPEC_TEMPLATE.md`).
2. Define TypeSpec API in `specs/api/src/modules/<module>.tsp`.
3. Run code generation pipeline (steps 2-3 above).
4. Create handler directory: `services/api-ts/src/handlers/<module>/`.
5. Create Drizzle schema in `repos/<entity>.schema.ts`.
6. Create repository in `repos/<entity>.repo.ts` (extend `DatabaseRepository`).
7. Generate database migration: `cd services/api-ts && bun run db:generate`.
8. Implement the **first vertical slice** — not the entire module at once.
9. Write tests for the first slice.
10. Run quality gates. Iterate.

## How to Add a New Vertical Slice

1. Read or write the slice spec (model after `docs/execution/slices/w1-t1-repo-consolidation/SLICE_SPEC.md`).
2. Inspect the Pattern Exemplar that matches your slice type.
3. Write/update tests first for business rules, validation, permissions.
4. Define or update TypeSpec API definitions.
5. Run code generation pipeline.
6. Implement handler.
7. Implement frontend (if full-stack slice).
8. Regenerate SDK if API changed.
9. Run contract tests + unit tests.
10. Verify against acceptance criteria.
11. Do not modify unrelated modules.

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Handler file | `camelCase` verb + noun | `createBooking.ts` |
| Schema file | `kebab-case.schema.ts` | `booking.schema.ts` |
| Repo file | `kebab-case.repo.ts` | `booking.repo.ts` |
| Test file | `kebab-case.test.ts` | `booking.test.ts` |
| TypeSpec file | `kebab-case.tsp` | `booking.tsp` |
| Route path | `/module/resource` | `/booking/slots` |
| DB table | `snake_case` | `booking_slots` |
| TS type | `PascalCase` | `BookingSlot` |
| Config env var | `SCREAMING_SNAKE` | `DATABASE_URL` |

## Pattern Exemplar Files

When implementing a new feature, inspect these modules first to copy the existing pattern:

| Pattern | Exemplar Module | Key Files | Notes |
|---|---|---|---|
| **Canonical CRUD** | `reviews` | `createReview.ts`, `repos/review.repo.ts` | Simplest: 4 handlers, 1 repo, no external service deps |
| Auth-coupled CRUD | `person` | `createPerson.ts`, `repos/person.repo.ts` | PII, consent, 1:1 user-person |
| Compliance logging | `audit` | `listAuditLogs.ts` | DB-only, admin role check |
| Notification state | `notifs` | `listNotifications.ts`, `markNotificationAsRead.ts` | DB-only handlers (push delivery is external) |
| Time-based scheduling | `booking` | Hosts, slots, events, exceptions | Complex module |
| External service | `billing` | Stripe Connect integration | Stripe API calls |
| File storage | `storage` | S3/MinIO presigned URL pattern | S3 presigned URLs |
| Real-time | `comms` | WebRTC + chat rooms | Chat DB + video rooms |
| Email templates | `email` | Handlebars templates + queue | SMTP + templates |
| Background jobs | `booking/jobs/` | `slotGenerator.ts`, `confirmationTimer.ts` | Job definition patterns |

> AI should NEVER invent a new pattern without checking exemplars first.

## Quality Gates

### Commands

```bash
bun run typecheck        # TypeScript checking across all workspaces
bun run lint             # ESLint across all workspaces
bun test                 # Unit tests (api-ts)
bun run build            # Build all workspaces
bun run test:contract    # Hurl contract tests (requires running API)
bun run test:contract:fuzz  # Schemathesis fuzz testing
```

### CI

All quality gates run on every PR. Contract tests boot the API, run Hurl, then run Schemathesis against the OpenAPI spec.

### Local Pre-Push Check

```bash
bun run typecheck && bun run lint && bun test && bun run build
```

## Monorepo Strategy

Workspaces: `apps/*`, `packages/*`, `services/*`, `specs/*`. All share a root `bun.lock`. Cross-workspace imports use `@monobase/<package>` aliases. Never import across workspaces by relative path.

## What Not to Do

- Do not invent a new folder structure without updating this document.
- Do not put business logic directly in UI components.
- Do not put complex business logic directly in generated routes.
- Do not build all APIs before the frontend workflow is validated.
- Do not build frontend-only screens without real backend behavior.
- Do not skip permission checks for protected actions.
- Do not skip tests for business rules, validation, permissions, and state transitions.
- Do not change unrelated modules as part of a slice.
- Do not edit generated files.

## App-Specific Deviations

### Existing modules built horizontally

The existing 25 handler modules were built pre-TDD using the horizontal approach (all handlers, then tests). New features should use vertical slices. Do not refactor existing modules to vertical slices unless there is a concrete reason.

### Known code issues

Documented in brownfield audit reports under `docs/audits/`. Key items tracked in `.planning/` state files. See CLAUDE.md "P0/P1 Risk Summary" for current status.

## Schema Registry Pattern

### ADR-001 — Ratify the schema-registry as the single audited cross-module surface

**Status:** Accepted (Wave G2, 2026-05-30)
**Context:** Cycle-3 audit IC-01 identified 20 core → handler imports across 11 files. The largest cluster (8 handler-owned Drizzle schemas re-exported by `services/api-ts/src/core/schema-registry.ts`) is consumed exclusively by `core/domain-event-consumers.ts` for cross-module event reactions (membership lapse, election completion, training credit award, etc.).

**Decision:** Ratify the registry as a sanctioned, single-point inversion rather than physically moving schemas into `core/`.

**Rationale:**
- Moving schemas into `core/` would invert ownership: `core/` would own handler tables, violating module autonomy and complicating migrations.
- The registry is a thin re-export layer with one consumer (`domain-event-consumers.ts`). Its blast radius is bounded and auditable.
- The pattern is explicit: every entry is annotated with the consuming use case, and the file carries an `[INTENTIONAL]` marker that distinguishes it from accidental core → handler imports.
- The set of exported tables is locked by `services/api-ts/src/core/schema-registry.test.ts`. Adding a new entry requires updating the test + this ADR.

**Enumerated tables (current surface):**

| Table | Owner module | Why core needs it |
|-------|--------------|-------------------|
| `notifications` | `notifs` | Domain-event consumers create notifications on cross-module triggers |
| `bookings` | `booking` | Audit + analytics rollups |
| `platformAdmins` | `platformadmin` | Impersonation guard, admin-bypass in org-context middleware |
| `trainings`, `trainingEnrollments` | `association:operations` | Training-credit award events |
| `memberships` | `association:member` | Org-context middleware lookup; lifecycle event consumers |
| `positions` | `association:member` | Election-completed events provision officer terms |
| `events`, `eventRegistrations` | `association:operations` | Registration confirmation flow |
| `invitationTokens` | `invite` | Invite-claimed events tie back to person/membership |

**Consequences:**
- All other core → handler imports (10 remaining per audit IC-01) are NOT sanctioned by this ADR. Those are tracked by Wave G2 slice **S-C4-014** (ports for governance / platform-admin repos) and follow-on slices for `core/email.ts`, `core/auth.ts`, etc.
- New cross-module schema needs must be added via the registry + ADR update, never via ad-hoc imports inside `core/`.

**Boundary rule:** If a core/ file imports a handler schema/repo NOT listed above, that import is an inversion debt — open a fix slice, do not extend the registry casually.
