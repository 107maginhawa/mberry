# Existing Codebase Adoption Audit

**Project**: Memberry — Healthcare Association Management System  
**Date**: 2026-05-08  
**Scope**: Backend (api-ts) + Admin app + Memberry app. Account app excluded.  
**Methodology**: 6-phase deep audit — inventory, mapping, security review, spec coverage, risk assessment, synthesis  
**Authority Hierarchy**: User instruction > Working code > docs/ver-3/ specs > CLAUDE.md > Existing patterns

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Codebase Inventory](#2-current-codebase-inventory)
3. [Current Architecture Summary](#3-current-architecture-summary)
4. [Existing Module Map](#4-existing-module-map)
5. [Existing UI/Screens Map](#5-existing-uiscreens-map)
6. [Existing API/Backend Map](#6-existing-apibackend-map)
7. [Existing Data Model/Schema Map](#7-existing-data-modelschema-map)
8. [Validation/Permissions/Auth/Audit Review](#8-validationpermissionsauthaudit-review)
9. [Testing Review](#9-testing-review)
10. [PRD/Spec Coverage Review](#10-prdspec-coverage-review)
11. [UI Prototype Coverage Review](#11-ui-prototype-coverage-review)
12. [Standards Gap Matrix](#12-standards-gap-matrix)
13. [Risk Assessment](#13-risk-assessment)
14. [Stabilization Plan](#14-stabilization-plan)
15. [Standards Adoption Plan](#15-standards-adoption-plan)
16. [First 3 Vertical Slices](#16-first-3-vertical-slices)
17. [Files to Create/Update](#17-files-to-createupdate)
18. [Final Recommendations](#18-final-recommendations)

---

## §1 Executive Summary

### Overall Maturity Assessment: 6.5/10

Memberry is a pre-launch healthcare AMS with significant engineering maturity — 22 backend handler modules, 72 database tables, ~550 endpoints, 3 frontend apps, and ~250 test files — built on the Monobase monorepo template. The codebase demonstrates strong fundamentals: centralized error handling (14 types), structured RBAC (4-layer system with 64+ position checks), excellent PRD documentation (7.5/10, 33 files in docs/ver-3/), and a disciplined vertical TDD approach with 250 test files.

However, the audit uncovered **7 P0 security risks** (all code-verified), **11 P1 issues**, **20 P2 improvements**, and **8 P3 items** that must be addressed before production deployment.

### Top 5 Dangers

1. **2FA secrets stored plaintext** — `text("secret")` in two_factor table. DB compromise = full TOTP bypass for every user.
2. **36% of tables (26/72) not org-scoped** — Fundamental multi-tenant isolation failure. Audit logs, billing, chat, person data accessible across organizations at DB level.
3. **castVote accepts raw JSON with no validation** — `ctx.req.json()` without schema. Spoofed UUIDs can corrupt election integrity.
4. **Email verification disabled** — `requireEmailVerification: false` in auth.ts. Anyone can register as `president@pda.org` without owning the mailbox.
5. **Session tokens stored plaintext** — Combined with any DB leak, all active sessions are hijacked.

### Key Findings

- **22 handler modules** exist (CLAUDE.md incorrectly claims 9)
- **PRD coverage 7.5/10** — docs/ver-3/ has 33 files including 19 module specs, 40 business rules, domain glossary, and role matrix
- **~60% TypeSpec coverage** — ~40% of modules use hand-wired routes without generated validators
- **3 overlapping comms modules** (comms, communication, communications) — consolidation needed
- **association:member is a mega-module** — 171 handlers (39% of entire API)
- **0 frontend unit tests** despite Vitest configuration
- **audit and email modules have 0 test files** — compliance-critical paths untested
- **Empty state UI coverage only 10%** — most list views show empty tables without messaging

### Recommended Next Steps

1. **Immediate (this week)**: Fix CLAUDE.md inaccuracies, create ARCHITECTURE.md, create handler-module map, build P0-P1 remediation roadmap
2. **Stabilization (8 weeks)**: All 7 P0 + 11 P1 fixes with test-first approach
3. **Spec reconstruction (6 weeks)**: TypeSpec coverage to 100%, RBAC endpoint spec, SDK regeneration
4. **New workflow adoption**: All new work uses vertical-slice TDD; existing modules migrated when touched

**Gate**: No new feature development until P0/P1 fixes are ≥50% complete.

---

## §2 Current Codebase Inventory

### Technology Stack

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

### Application Entry Points

| App | Port | Location | Purpose |
|-----|------|----------|---------|
| account | 3002 | `apps/account/` | Auth, profile, settings (excluded from audit) |
| admin | 3003 | `apps/admin/` | Platform ops dashboard |
| memberry | 3004 | `apps/memberry/` | Product app — membership, dues, events, training |
| api-ts | 7213 | `services/api-ts/` | Reference Hono + Drizzle API |

### External Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| Stripe | Billing/payments via Connect | Integrated |
| OneSignal | Push notifications | Integrated |
| S3/MinIO | File storage | Integrated |
| Postmark/Nodemailer | Transactional email | Integrated |
| pg-boss | Background job queue | Integrated |
| WebRTC | Video calls (infra-ready) | Scaffolded |

### Testing Stack

| Framework | Purpose | Location |
|-----------|---------|----------|
| Bun test | Backend unit + integration | `services/api-ts/src/**/*.test.ts` |
| Vitest | Frontend unit (configured, sparse) | `apps/*/src/**/*.test.*` |
| Playwright | E2E tests | `apps/*/tests/e2e/` |
| Hurl + Schemathesis | Contract tests | `specs/api/tests/contract/` |

### Docker Dev Dependencies

postgres:16-alpine, minio, mailpit, stripe-mock

### Mock Data

Seed scripts isolated: `seed.ts`, `seed-modules.ts`, `seed-rich.ts`. No production code depends on mock data. Clean separation confirmed.

### Build/Dev Scripts

Standard Bun workspace commands. `bun dev` per app/service, `bun run build` for specs, `bun run generate` for code generation. All commands verified accurate against actual `package.json` files.

---

## §3 Current Architecture Summary

### Middleware Stack (10 layers, in order)

```
requestId → DI → audit → requestLogger → securityHeaders → CORS → auth → platformAdmin → officerAuth → orgContext
```

1. **requestId**: Attaches UUID to every request
2. **DI**: Dependency injection container setup
3. **audit**: After-middleware captures write operations to audit_log_entries
4. **requestLogger**: Pino structured logging with correlation IDs
5. **securityHeaders**: Standard security headers
6. **CORS**: Cross-origin configuration
7. **auth**: Better-Auth session extraction + validation
8. **platformAdmin**: DB lookup in platform_admins table for `/admin/*`
9. **officerAuth**: Position-based access control (64+ uses)
10. **orgContext**: Organization scoping from `x-org-id` header

### Auth Flow

```
Better-Auth session extraction → middleware role check → handler access
```

**Plugins**: emailOTP, admin, bearer, twoFactor, magicLink, apiKey, passkey

**Internal bypass**: `X-Internal-Service-Token` header for service-to-service calls (untyped, no rotation — P1 risk)

### Route Registration

- **Generated routes**: 2493 lines from TypeSpec compilation (348 routes with validators)
- **Hand-wired routes**: 40+ custom endpoints in app.ts for `/persons/me/*`, `/officer-terms/*`, `/credit-compliance/*`, `/dues/dashboard/*`, etc.
- **8 inline routes** bypass the TypeSpec pipeline entirely (P1 risk)

### Generated vs Hand-Written Boundaries

| Generated (DO NOT EDIT) | Hand-Written |
|--------------------------|-------------|
| `src/generated/openapi/*` — routes, validators, registry | Handler implementations (`src/handlers/*/`) |
| `src/generated/better-auth/*` — auth schema/specs | Repository schemas (`src/handlers/*/repos/*.schema.ts`) |
| `src/generated/migrations/*` — DB migrations | Middleware (`src/middleware/`) |
| OpenAPI spec (`specs/api/dist/`) | Core services (`src/core/`) |
| SDK types (`packages/sdk-ts/`) | `app.ts` route registration |

### Service Layer

**None.** Business logic lives directly in handlers → repos. No intermediate use-case or service classes. This is a P2 structural issue — harder to test and reuse complex business logic.

### Error Handling

**Excellent.** Centralized in `core/errors.ts`. 14 error types extending `AppError`:

`UnauthorizedError`, `ForbiddenError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalError`, `BadRequestError`, `PaymentRequiredError`, `MethodNotAllowedError`, `GoneError`, `UnprocessableEntityError`, `ServiceUnavailableError`, `HipaaComplianceError`

Security-filtered in production. Consistent JSON format with requestId, timestamp, error code.

---

## §4 Existing Module Map

### 22 Handler Modules

| Category | Module | Handlers | Tests | TypeSpec | Notes |
|----------|--------|----------|-------|----------|-------|
| **Core identity** | person | 25 | 6 | Yes | Central PII hub |
| **Association** | association:member | 157 | 14 | Yes | MEGA-MODULE: 39% of all handlers |
| **Association** | association:operations | 54 | 2 | Yes | Overlaps events module |
| **Platform** | platformadmin | 21 | 6 | Yes | Admin-tier only |
| **Membership** | membership | 12 | 15 | Hand-wired | OfficerAuth + per-handler |
| **Membership** | dues | 15 | 17 | Hand-wired | Mixed auth patterns |
| **Membership** | invite | 3 | 2 | Yes | No orgId param |
| **Billing** | billing | 16 | 5 | Yes | Complete Stripe integration |
| **Events/Training** | booking | 19 | 1 | Yes | Per-handler org checks |
| **Events/Training** | events | 11 | 8 | Yes | Per-handler org checks |
| **Events/Training** | training | 10 | 1 | Hand-wired | OrgId scoped |
| **Events/Training** | elections | 6 | 1 | Yes | **P0: castVote no validation** |
| **Comms** | communication | 28 | 1 | Yes | Templates, queuing |
| **Comms** | communications | 8 | 5 | Hand-wired | Announcements |
| **Comms** | comms | 11 | 1 | Yes | WebSocket: video, chat |
| **Content** | documents | 15 | 1 | Yes | Access-log tracking |
| **Content** | certificates | 3 | 2 | Yes | Minimal |
| **Content** | storage | 6 | 0 | Yes | **P0: uploadFile no validation** |
| **Content** | reviews | 4 | 1 | Yes | Minimal |
| **Compliance** | audit | 1 | **0** | Yes | **P0: 0 tests, not org-scoped** |
| **Compliance** | email | 9 | **0** | Yes | Queue management |
| **Compliance** | notifs | 5 | 1 | Mixed | Minimal |

**Key observations:**
- **TypeSpec coverage ~60%**: membership, dues, training, communications, and several others are hand-wired
- **3 overlapping comms modules**: comms + communication + communications — clear consolidation debt
- **5 modules with background jobs**: email (3), booking (6), dues (3), notifs (1), audit (1)
- **Testing distribution**: Heavy coverage for dues (17), membership (15), association:member (14). Zero for audit and email.

### Staleness Audit Results

| Document | Status | Finding |
|----------|--------|---------|
| CLAUDE.md | **STALE** | Claims 9 modules (22 exist); claims consent JSONB fields (don't exist in schema) |
| CONTRIBUTING.md | Accurate | All scripts, branching, test commands match actual code |
| VERTICAL_TDD.md | Accurate | Test layers, runners, vertical slice approach all match |
| docs/ver-3/ | **Drift** | Contains plan.md, DESIGN.md, business specs, UX specs — but no individual module specs as standalone files; TypeSpec + code = actual authority |
| .planning/ | Accurate | STATE.md shows milestone v1.0.0, Phase 13 in progress |

---

## §5 Existing UI/Screens Map

### Route Summary

**73 total routes**: 63 Memberry + 10 Admin. Account app excluded per scope.

### Memberry App (63 routes)

| Category | Routes | Auth | Notes |
|----------|--------|------|-------|
| Public | 8 | None | Auth, onboarding, invite, pay, verify, org profile |
| Protected | 55 | `_authenticated` layout guard | Member-facing features |
| Officer | 34 | Position validation | Under `/org/$orgId/officer/*` |

**14 feature modules**: membership, training, events, communications, chapters, dues, elections, certificates, notifications, profile, directory, invite, dashboard, admin

### Admin App (10 routes)

Dashboard, associations, organizations, members, operators, impersonate, feature flags, audit log.

**Gaps identified:**
- Uses raw `fetch('/api/admin/*')` — NO SDK usage (inconsistent with memberry app)
- No role-based gates — assumes all authenticated admin users have full access (P1 risk)

### Data Sources

- 89% real API calls (useQuery/useMutation/SDK)
- 0% mock data in production routes (clean separation)
- 20+ routes use auto-generated SDK hooks from `@monobase/sdk-ts`

### State Handling Coverage

| State | Coverage | Notes |
|-------|----------|-------|
| Loading | 98% | CardSkeleton/SkeletonLoader |
| Error | 88% | ErrorBoundary + React Query |
| Empty | **10%** | Major gap — most lists show empty table |
| Permission | 87% | TanStack Router beforeLoad guards |

### Component Architecture

- 9 shared pattern components (error-boundary, skeleton-loader, data-table, empty-state, etc.)
- 5 layout components (member-sidebar, officer-sidebar, mobile navs, header)
- Feature-specific components in `/features/*/components/`
- No prototype/placeholder screens detected

### Key UI Gaps

1. **Empty state coverage only 10%** — should be 80%+ for new org onboarding experience
2. **Admin app uses raw fetch, not SDK** — inconsistent with memberry pattern
3. **No breadcrumb navigation** for deep routes (officer settings 5 levels deep)
4. **No ARIA labels detected** — accessibility audit needed

---

## §6 Existing API/Backend Map

### Endpoint Summary

| Category | Count |
|----------|-------|
| Generated routes (TypeSpec → routes.ts) | 348 |
| Hand-wired routes (app.ts) | 24 |
| Handler functions (registry.ts) | 215 |
| Handler files total | 440+ |
| **Total endpoints** | **~550+** |

### Per-Module Detail

| Module | Handlers | Registration | Validation | Auth | Tests | Risk |
|--------|----------|-------------|------------|------|-------|------|
| association:member | 171 | Generated | TypeSpec validators | Registry | ~2% | Mega-module |
| association:operations | 56 | Generated | TypeSpec validators | Registry | ~2% | Overlaps events |
| person | 30 | Generated | ValidatedContext (partial) | Auth + per-user | 1 | Mixed validation |
| communication | 29 | Generated | None explicit | Auth | 1 | Overlaps comms |
| dues | 31 | Hand-wired | None explicit | OfficerAuth | 1 | Mixed auth |
| platformadmin | 26 | Generated | None explicit | Auth + implicit admin | 0 | Untested |
| billing | 23 | Generated | TypeSpec zValidator | Auth | 5 | Complete Stripe |
| booking | 21 | Generated | ValidatedContext + zValidator | Auth | 1 | Per-handler org |
| events | 20 | Generated | None explicit | Auth + per-handler | 8 | Per-handler org |
| training | 18 | Hand-wired | None explicit | Auth + officerAuth | 1 | — |
| documents | 16 | Generated | zValidator (json/param) | Auth | 1 | Access-log |
| comms | 13 | Generated | None explicit | Auth (mostly) | 1 | WebSocket |
| communications | 12 | Hand-wired | None explicit | Auth + per-handler | 5 | Draft→publish |
| membership | 26 | Hand-wired | None explicit | OfficerAuth + per-handler | 1 | No orgId on review |
| elections | 12 | Generated | **NONE — raw ctx.req.json()** | Auth (implicit) | 1 | **P0** |
| email | 9 | Generated | None explicit | Auth | 0 | — |
| storage | 7 | Generated | **NONE — raw ctx.req.json()** | Auth | 0 | **P0** |
| certificates | 5 | Generated | None explicit | Auth | 2 | — |
| invite | 6 | Generated | None explicit | Auth + public | 2 | — |
| notifs | 6 | Generated/Hand | None explicit | Auth | 1 | — |
| reviews | 5 | Generated | None explicit | Auth | 1 | — |
| audit | 1 | Generated | None visible | Auth | 0 | **P0** |

### Validation Patterns (4 inconsistent patterns)

| Pattern | Coverage | Maturity |
|---------|----------|----------|
| TypeSpec `zValidator` | 348 routes | HIGH |
| `ValidatedContext<T>` | ~5 modules | MEDIUM |
| `ctx.req.valid()` | ~5 routes | MEDIUM |
| Raw `ctx.req.json()` | ~4 handlers | **NONE — P0** |
| No validation visible | ~80 routes | LOW |

### Architecture Issues

- **No service layer** — logic in handlers → repos directly
- **Inconsistent API naming** — mix of plural entities, singular, nested, /me endpoints, query suffixes
- **6+ routes with per-handler auth** instead of middleware-level enforcement
- **3 overlapping comms modules** with unclear ownership

---

## §7 Existing Data Model/Schema Map

### Database Summary

**72 tables** across 29 schema files in 19 handler modules + better-auth.

### Organization Scoping (Critical Multi-Tenant Issue)

| Scoping | Table Count | Percentage |
|---------|-------------|------------|
| Properly org-scoped (organizationId FK) | 46 | 64% |
| **NOT org-scoped** | **26** | **36%** |

### Unscoped Tables (26) — Multi-Tenant Risk

| Category | Tables | Risk |
|----------|--------|------|
| better-auth | user, session, account, verification, passkey, two_factor, apikey (7) | Auth is global by design, but session/2FA have security issues |
| audit | audit_log_entry (1) | **CRITICAL**: HIPAA-relevant but global — cross-org audit trail exposure |
| billing | invoice, merchant_account, invoice_line_item (3) | Cross-org financial data leakage |
| booking | booking_event, schedule_exception (2) | — |
| chat | chat_room, chat_message (2) | Participants as JSONB, no org FK |
| email | email_template, email_queue (2) | — |
| notifications | notification (1) | — |
| person | person, notification_preference, privacy_settings (3) | Central PII hub — visible across all orgs |
| reviews | 1 | — |
| storage | stored_file (1) | — |

### Person Table (Hub Entity)

- Referenced by 20+ tables across all org-scoped modules
- PII fields: firstName, lastName, dateOfBirth, primaryAddress (JSONB), contactInfo (JSONB), avatar
- Soft-delete workflow: deletionRequestedAt → scheduledAt → completedAt
- **No organizationId** — visible across all orgs at DB level
- **No FK to better-auth `user` table** — linking is implicit

### Security Findings

| Finding | Severity | Details |
|---------|----------|---------|
| 2FA secrets plaintext | **CRITICAL** | `text("secret")` in two_factor table |
| Audit log not org-scoped | **CRITICAL** | No organizationId column |
| user.email unique globally | HIGH | Blocks multi-org membership for same email |
| Session tokens plaintext | MEDIUM | `text("token")` in session table |
| Missing FK constraints | MEDIUM | event_registration.eventId, person refs across modules |
| JSONB fields unvalidated at DB layer | MEDIUM | primaryAddress, contactInfo, details |

### Financial Tables

| Status | Tables |
|--------|--------|
| Org-scoped | dues_config, dues_invoice, dues_payment, dues_fund, membership_tier (annualFee), event (registrationFee) |
| **NOT org-scoped** | invoice, merchant_account, invoice_line_item — cross-org leakage risk |

### Migrations

16 migrations (0000-0015). Zero data-loss pattern. Migration 0014 renamed tenantId → organizationId across 44 tables (idempotent).

### Index Coverage

| Status | Tables |
|--------|--------|
| Well-indexed | audit_log_entry (9), booking_event (28), billing invoice (9) |
| **Under-indexed** | stored_file (0!), notification (no org lookup), election (missing voter index) |

### Missing at Schema Level

- Global unique constraints (memberNumber, licenseNumber, certificateNumber)
- Full-text search indexes
- Partitioning for large tables (audit_log_entry, email_queue)

---

## §8 Validation/Permissions/Auth/Audit Review

### 8.1 Validation

**Current Pattern**: Primary pattern is TypeSpec-generated `zValidator` middleware in `routes.ts` — 132 routes with body validation, 80 with query validation. Secondary: `ValidatedContext<T>` (~5 modules), `ctx.req.valid()` (~5 routes). Dangerous tertiary: raw `ctx.req.json()` with no schema.

**Gaps**:
1. `castVote.ts` — `await ctx.req.json()` with no schema. positionId/nomineeId unvalidated → vote injection
2. `uploadFile.ts` — TypeScript cast `as { filename, size, mimeType }`, no runtime validation. No MIME allowlist, no filename sanitization, no length limit
3. ~56 GET endpoints have no query param validation
4. `requireEmailVerification: false` in auth.ts (labeled "Disabled for testing")
5. `updateScheduleException` uses `ValidatedContext<any, any, any>` — type safety defeated

**Risks**:
- **P0**: castVote data injection — spoofed nominee UUID corrupts election integrity
- **P0**: uploadFile MIME injection — attacker-controlled mimeType enables content-type spoofing/XSS
- **P1**: 56+ unvalidated GET endpoints — DoS via malformed pagination
- **P1**: No email verification enables account enumeration and identity squatting

**Recommended Action**:
1. (P0) Add `zValidator('json', CastVoteBody)` with UUID validation
2. (P0) Add MIME allowlist + filename sanitization to uploadFile.ts
3. (P1) Enable `requireEmailVerification: true` before production
4. (P2) Fix `ValidatedContext<any>` and add query validators for remaining GETs

### 8.2 Authentication

**Current Pattern**: Better-Auth manages `/auth/*` routes. Sessions via Bearer token or cookie. Rate limiting: 10 req/60s (configurable). Cookie config: `httpOnly: true`, `secure` and `sameSite` from config.

**Gaps**:
1. `requireEmailVerification: false` — anyone registers with any email
2. 2FA enabled but not enforced — opt-in only. Admin/treasurer/president unprotected
3. Internal bypass token: untyped (`(app as any).internalServiceToken`), no rotation, no expiry
4. Rate limiting only on Better-Auth routes; custom inline routes have none
5. API key plugin enabled but no rotation or scoping mechanism
6. Session expiry default not audited

**Risks**:
- **P0**: Unverified email auth — register as `president@pda.org` without owning mailbox
- **P1**: No MFA enforcement for privileged roles — credential stuffing viable
- **P1**: Internal bypass logged at DEBUG only, not in audit trail
- **P2**: Token sourced from untyped app property

**Recommended Action**:
1. (P0) Enable `requireEmailVerification: true`
2. (P1) Enforce 2FA for admin/coordinator/treasurer/president positions
3. (P1) Log internal service token usage to audit log
4. (P2) Source `INTERNAL_SERVICE_TOKEN` from named env var with startup assertion

### 8.3 Authorization / RBAC

**Current Pattern**: Four-layer RBAC:
1. **System roles** (Better-Auth): `admin`/`user` — OR logic via `userHasRole()`
2. **Platform admin**: DB lookup in `platform_admins` table for `/admin/*`
3. **Org membership** (`orgContextMiddleware`): Verifies membership from `x-org-id` header. Platform admins bypass with synthetic admin membership
4. **Position-based** (`requirePosition`): DB lookup via `OfficerTermRepository.findActiveByPersonAndOrg()`. 4 titles: President, Treasurer, Secretary, Society Officer. Used 64+ times

**Gaps**:
1. `officerAuthMiddleware` silently skips if no `:orgId` in path — routes without orgId param have NO officer check fallback
2. 6 inline routes in app.ts bypass generated route system — no TypeSpec, no validators, not regeneratable
3. 26/72 tables not org-scoped — audit_log_entries has NO organizationId
4. Ownership checks delegated 100% to handlers — if handler forgets, route is open
5. Role name inconsistency: 5 different naming conventions
6. No session invalidation on org role change

**Risks**:
- **P0**: Cross-org audit log access
- **P1**: Silent officer auth bypass on routes without `:orgId`
- **P1**: 6 inline routes not regeneratable from TypeSpec
- **P2**: Role name mismatches may silently grant/deny incorrectly

**Recommended Action**:
1. (P0) Add `organizationId` to audit schema, scope queries by org
2. (P1) Convert 6 inline app.ts routes to TypeSpec or add inline zValidator
3. (P1) Add fallback ensuring per-handler checks exist when officerAuth skips
4. (P2) Create shared `ROLES` constant

### 8.4 Audit Logging

**Current Pattern**: Two-tier system:
1. **Global middleware** (`createAuditMiddleware()`): After-middleware captures POST/PUT/PATCH/DELETE. Fields: eventType, category, action, outcome, user.id, resourceType, resource, ipAddress, userAgent. Failures swallowed silently.
2. **Handler-level**: Some handlers call `repo.logEvent()` or `logger.info()` with richer context. Inconsistent — some go to audit_log_entries, some only to Pino stdout.

Schema: `audit_log_entries` with eventType, category, action, outcome, user, details (JSONB), retentionStatus. HIPAA-labeled enums. **No organizationId column.**

**Gaps**:
1. No org isolation — every audit entry is global
2. URL-segment parsing produces wrong resourceType values
3. GET requests not audited — reading PII, financial data unlogged
4. Auth events not captured — login/logout/2FA not wired to audit table
5. Category always `'association'` — semantically wrong for financial/clinical ops
6. Split between Pino logger and audit table
7. Silent failure — if audit DB down, request succeeds but entry lost
8. No immutability — no DB triggers preventing UPDATE/DELETE on audit records

**Risks**:
- **P0**: Multi-tenant audit isolation failure
- **P0**: Incomplete audit trail — HIPAA-adjacent compliance audit would fail
- **P1**: Misleading entries from URL-segment parsing — forensics unreliable
- **P1**: Silent audit loss — no alerting, no replay on failure
- **P2**: Audit data tamperable

**Recommended Action**:
1. (P0) Add `organizationId` to audit schema, populate from `ctx.var.orgId`
2. (P0) Wire Better-Auth hooks for auth events to audit_log_entries
3. (P1) Fix resourceType extraction — use `ctx.req.routePath` or route-prefix map
4. (P1) Add audit for sensitive GETs
5. (P2) PostgreSQL row-level security for append-only audit table

---

## §9 Testing Review

### 9.1 Test Inventory

| Test Type | Framework | File Count | Quality | Notes |
|-----------|-----------|------------|---------|-------|
| Unit (backend) | Bun test | ~152 | Moderate | In-memory stubs via makeCtx/stubRepo |
| Unit (core/middleware) | Bun test | ~22 | Good | Real behavior; mocks only for logger/audit |
| Unit (frontend) | Vitest | **0** | None | Config exists, zero test files |
| Integration | Bun test | 6 | Good | Route protection, position RBAC, seed users |
| E2E (memberry) | Playwright | 41 | Moderate-Good | Actions + journeys + member suites |
| E2E (admin) | Playwright | 5 | Shallow | Smoke + 4 modules |
| E2E (account) | Playwright | 3 | Shallow | Activation, onboarding, settings |
| Contract | Hurl | 44 files, 27 scenarios | Good | ~220 requests |
| Permission/RBAC | Bun test | 4 dedicated | Good | 401/403, IDOR, position-based |
| Validation | Bun test | ~20+ files | Moderate | Dues, booking, membership |
| State Transition | Bun test | ~8 dedicated | Moderate | Approval/deny/reinstate/cancel |
| BR Edge Cases | Bun test | 1 file | Shallow | 6 BRs covered, ~15 test.todo stubs |

**Total: ~250 test files** (230 backend, 20 E2E; 0 frontend unit)

### 9.2 Per-Module Coverage

| Module | Test Files | Quality | Key Gaps |
|--------|-----------|---------|----------|
| dues | 22 | Deep | Payment webhook idempotency, concurrent payment |
| membership | 16 | Deep | Bulk import edge cases, onboarding notifications |
| association:member | 15 | Deep | Chapter hierarchy rules |
| events | 11 | Moderate-Deep | Capacity enforcement, waitlist |
| training | 10 | Moderate-Deep | Prerequisites, CPD calculation |
| elections | 8 | Moderate | Nomination eligibility, vote audit trail |
| billing | 8 | Moderate | Stripe webhook signature, full refund flow |
| platformadmin | 6 | Moderate | Bulk admin ops |
| person | 6 | Moderate | PII redaction, data export |
| booking | 6 | Moderate | Schedule conflict resolution |
| communications | 6 | Moderate | Draft→publish state machine |
| certificates | 4 | Shallow-Moderate | Expiry/revocation |
| invite | 3 | Shallow | Expiry, rate limiting |
| comms | 2 | Shallow | Room access control |
| association:operations | 2 | Shallow | Analytics, cross-chapter rollups |
| storage | 1 | Shallow | Access control, MIME validation |
| reviews | 1 | Shallow | Visibility, moderation |
| notifs | 1 | Shallow | Channel selection |
| email | 1 | Shallow | Template rendering |
| documents | 1 | Shallow | Access control by role |
| communication | 1 | Unknown | Likely legacy duplicate |
| **audit** | **0** | **None** | **Entire module untested** |

### 9.3 Critical Workflow Coverage

| Workflow | Tested? | Gaps |
|----------|---------|------|
| Registration + onboarding | Partial | No backend unit test for post-registration |
| Login + session | Yes | 2FA/OTP scenarios deferred |
| Membership application + approval | Yes | Notification on approval untested |
| Dues payment + receipt | Yes | Concurrent race condition untested |
| Event registration + check-in | Yes | Capacity/waitlist edge cases |
| Election + voting | Yes | Nomination eligibility gaps |
| Certificate generation | Partial | Trigger conditions untested |
| Training credits | Yes | CPD calculation edge cases |
| Announcement publish | Partial | No unit test for draft→publish |
| **Document upload + access** | **None** | **Entire flow untested** |
| Financial (billing, refunds) | Partial | Stripe refund flow deferred |
| Role/position assignment | Yes | Position expiry/handover untested |
| Org creation + member join | Partial | Self-join from public page no E2E |

### 9.4 Business Rules Coverage

`docs/ver-3/business/business-rules.md` defines 40 BRs (BR-01–BR-40), declared normative. Machine-readable registry at `br-registry.json` + `br-registry.ts`.

Tested BRs: BR-10 (impersonation audit), BR-21 (multi-org membership), BR-30 (gateway isolation), BR-33 (election integrity), BR-09 (officer API auth via Hurl). ~15 `test.todo()` stubs for unimplemented BRs.

No comprehensive BR-to-test traceability matrix exists.

### 9.5 Contract Test Coverage

44 files, 27 scenarios, ~220 requests. Covers: auth, person, booking, billing, comms, communications, dues, elections, events, governance, membership, training, certificates, credentials, credits, storage, notifs, reviews, email, audit side-effects, security, platform, impersonation, feed moderation, public flow.

**NOT covered**: WebSocket, 2FA/OTP, Stripe webhook signatures, full refund flow, documents module, `communication` module, platformadmin CRUD beyond impersonation.

### 9.6 Test Quality Assessment

- **Approach**: Behavior-oriented. `makeCtx`/`stubRepo` pattern — handler called directly with fabricated context
- **No real DB in unit tests**: All repos stubbed. Real DB only in Hurl contracts + Playwright E2E
- **Flakiness**: Low. 1 `test.skip`, ~15 `test.todo()` (known backlog)
- **Fixtures**: Well-structured `makeCtx`, `makeUser`, `makeOfficer`, `makeMember` in centralized `test-utils/make-ctx.ts`
- **Isolation concern**: E2E tests share persistent seed data — no per-test DB reset
- **Resilience risk**: Some `.catch(() => false)` patterns may mask regressions

### 9.7 Missing Tests Priority

**P0 — Security-critical, no tests:**
- audit module: 0 tests (log creation, retrieval, filtering, access control)
- storage module: Access control, MIME validation, size limits
- documents module: 0 contract tests, access control

**P1 — Financial/compliance, insufficient:**
- Dues concurrent payment race condition
- Full Stripe refund flow
- Billing webhook signature verification
- Gateway idempotency

**P2 — Core workflows, shallow:**
- notifs, comms, reviews, email modules
- Membership onboarding notification
- Position expiry/succession

**P3 — Coverage improvements:**
- Frontend unit tests: 0 files
- Admin E2E: only 5 specs
- Account E2E: no password change, no 2FA flow
- E2E test isolation (per-test DB reset)
- ~15 `test.todo()` stubs

---

## §10 PRD/Spec Coverage Review

### Score: 7.5/10

| # | Artifact | Location | Exists? | Quality | Notes |
|---|----------|----------|---------|---------|-------|
| 1 | Master PRD | `docs/ver-3/plan.md` | Yes | 8/10 | Problem statement, 3-phase trajectory, goals, metrics. Lacks per-feature acceptance criteria |
| 2 | Domain Glossary | `docs/ver-3/business/terminology.md` | Yes | 9/10 | Core entities, officer sub-roles, membership lifecycle state machine, "Do NOT use" column |
| 3 | Role Permission Matrix | `docs/ver-3/business/personas-and-roles.md` §4 | Yes | 7/10 | 6 personas (P1-P6), capability-level matrix. Missing: per-endpoint RBAC |
| 4 | Module Map | `docs/ver-3/business/modules/README.md` | Yes | 9/10 | 19 modules, phase/wave/priority, dependency tree, monetization tiers |
| 5 | Module Specs (per module) | `docs/ver-3/business/modules/m01-m19` | Yes (19/19) | 8/10 | All 19 have specs with user journeys. Gap: narrative, not testable |
| 6 | Vertical Slice Plan | `VERTICAL_TDD.md` (root) | Yes | 7/10 | Process defined. No slice-by-slice delivery plan |
| 7 | Slice Specs | `.planning/milestones/v1.0.0-phases/` | Partial | 6/10 | Implementation plans, not product slice specs |
| 8 | Business Rules | `docs/ver-3/business/business-rules.md` | Yes | 9/10 | 40 BRs (BR-01–BR-40), normative. Machine-readable registry |

### Additional Artifacts Found

- context.md, cross-cutting.md, metrics.md, roadmap.md
- 20+ UX screen specs in docs/ver-3/ux/
- DESIGN.md (32KB design system)
- GAP-BACKLOG.md
- manifest.json (33 files indexed)

### Source of Truth (Layered)

1. **Product requirements** → `docs/ver-3/` (v3 PRD suite, 33 files)
2. **API contract** → `specs/api/dist/openapi/openapi.json` (TypeSpec-generated)
3. **Execution plans** → `.planning/` (derivative, not authoritative)
4. **Code as implicit spec** → 22 handler modules (biggest gap — behavior not in PRD or TypeSpec)

### 5 Critical Gaps

1. **PRD-to-Code Module Mismatch** — PRD defines 19 modules (m01-m19). Codebase has 22 handler dirs. No mapping document exists.
2. **No TypeSpec for Memberry Domain Modules** — Core domain (membership, dues, events, training, credits, elections) has NO TypeSpec. Hand-wired routes bypass spec-first workflow.
3. **No Per-Endpoint RBAC Spec** — Permission matrix is capability-level, not endpoint-level.
4. **Module Specs Lack Testable Acceptance Criteria** — Narrative journeys, not machine-parseable assertions.
5. **No Slice Delivery Specs** — Process defined but no actual slice specifications.

---

## §11 UI Prototype Coverage Review

### Per-Module Prototype Docs: 0/22

No modules have the standard prototype doc set (screens.md, components.md, interaction-states.md, mock-data.md).

### However: Superior Alternative Exists

`docs/ver-3/ux/` contains ~74+ persona-organized screen docs:
- 4 cross-cutting: screen-inventory.md, navigation.md, states.md, interaction-patterns.md
- Per-screen docs by role: auth (6), member (16), officer (37+), org-member (5+), platform-admin (10+)

### Handler-to-UI Coverage

14/22 modules covered by UX docs.

**4 gaps**: audit admin screen, documents module, reviews module, admin impersonate/feature-flags.

### Recommendation

Do NOT create per-module prototype docs. The ver-3 UX system (persona-organized) is superior to module-organized prototypes. Fill the 4 missing screen docs. Treat existing UI as reference, not product truth.

---

## §12 Standards Gap Matrix

| # | Area | Current State | Gap | Risk | Priority |
|---|------|--------------|-----|------|----------|
| 1 | **CLAUDE.md accuracy** | Claims 9 modules (22 exist); consent JSONB unimplemented | **Misleads all AI-assisted development** | High | **P0** |
| 2 | Validation | 4 inconsistent patterns; castVote/uploadFile raw json | P0 security risk + inconsistency | High | P1 |
| 3 | Permissions/RBAC | officerAuth silent skip; 26/72 tables unscoped | Multi-tenant isolation failure | High | P1 |
| 4 | Tests | 250 files; audit 0 tests; 0 frontend unit tests | Compliance-critical untested | Med | P1 |
| 5 | Audit logging | Not org-scoped; auth events missing; 0 tests | HIPAA compliance gap | High | P1 |
| 6 | Auth security | Email verification disabled; 2FA not enforced; bypass unlogged | Multiple P0/P1 security gaps | High | P1 |
| 7 | Data model integrity | Missing FKs; 2FA plaintext; 26 unscoped tables | Structural integrity issues | High | P1 |
| 8 | PRD/Master Requirements | plan.md + 19 module specs + 40 BRs | Fragmented; no requirement IDs for traceability | Med | P2 |
| 9 | Architecture docs | No ARCHITECTURE.md | Completely missing | Med | P2 |
| 10 | API naming consistency | 3 comms modules; colon-namespaced; 40+ inline routes | Confusing; maintenance burden | Med | P2 |
| 11 | Service layer | None — logic in handlers directly | Harder to test/reuse | Med | P2 |
| 12 | Frontend unit tests | 0 files (Vitest configured) | Config ready, sparse coverage | Med | P2 |
| 13 | E2E test isolation | Shared seed data; no per-test reset | Test interdependence risk | Med | P2 |
| 14 | Module map doc | No handler→spec→UI cross-reference | Missing Rosetta Stone | Med | P2 |
| 15 | TypeSpec coverage | ~60% modules covered | ~40% lack generated validators | Med | P2 |
| 16 | UI Prototype docs | 74+ persona-organized screen docs; 4 gaps | Minor gaps in alternative system | Low | P3 |
| 17 | docs/templates | Missing | No module/handler/test templates | Low | P3 |
| 18 | docs/checklists | Only EXECUTION-CHECKLIST.md | Skills cover this but not documented for humans | Low | P3 |
| 19 | docs/ai-workflow | Missing (17 skills exist but no guide) | No human-readable workflow guide | Low | P3 |
| 20 | Role/Permission matrix | personas-and-roles.md exists | May need endpoint-level mapping | Low | P3 |

**Summary**: 1 P0, 6 P1, 8 P2, 5 P3, plus 5 areas with no gap (CONTRIBUTING.md, VERTICAL_TDD.md, domain glossary, business rules, error handling).

---

## §13 Risk Assessment

All P0 claims verified against actual source code.

### P0 — Fix Immediately (7)

| # | Finding | Verified | Location | Impact |
|---|---------|----------|----------|--------|
| 1 | 2FA secrets plaintext (`text("secret")`) | YES | `services/api-ts/src/generated/better-auth/schema.ts` | DB compromise = full 2FA bypass |
| 2 | castVote raw `ctx.req.json()` no validation | YES | `services/api-ts/src/handlers/elections/castVote.ts` | Vote injection, election corruption |
| 3 | uploadFile no MIME allowlist, no filename sanitization | YES | `services/api-ts/src/handlers/storage/uploadFile.ts` | Path traversal, MIME spoofing, XSS |
| 4 | 36% tables (26/72) not org-scoped | Structural | Multiple schema files | Multi-tenant data leakage |
| 5 | Session tokens plaintext (`text("token")`) | YES | `services/api-ts/src/generated/better-auth/schema.ts` | Session hijack on DB exposure |
| 6 | `requireEmailVerification: false` | YES | `services/api-ts/src/core/auth.ts` line 79 | Identity squatting, impersonation |
| 7 | Audit log no `organizationId` column | YES | `services/api-ts/src/handlers/audit/repos/audit.schema.ts` | HIPAA compliance gap |

### P1 — Fix Before Major New Work (11)

| # | Finding | Impact |
|---|---------|--------|
| 1 | Per-handler auth (6+ routes) bypasses middleware | Auth bypass if check omitted |
| 2 | Internal service bypass: untyped, no rotation, no expiry | Permanent unauth access if leaked |
| 3 | Rate limiting only on Better-Auth routes | Brute-force on custom endpoints |
| 4 | officerAuth silently skips without `:orgId` | Officer checks bypassed |
| 5 | 2FA not enforced for privileged roles | Single-factor for admins |
| 6 | No session invalidation on role change | Removed officer retains access |
| 7 | Admin app no role gates | All admins = full access |
| 8 | user.email unique globally | Blocks multi-org membership |
| 9 | 8 inline app.ts routes bypass TypeSpec | No validators, not regeneratable |
| 10 | Auth events not in audit trail | Login/logout/2FA untracked |
| 11 | association:member mega-module (171 handlers) | Unmaintainable, high coupling |

### P2 — Fix When Touching Module (20)

1. 3 overlapping comms modules
2. ~10% test coverage across handlers
3. Missing FK constraints
4. Inconsistent validation (4 patterns)
5. Missing DB indexes (stored_file: 0)
6. No unique constraints (memberNumber, licenseNumber)
7. Audit URL parsing produces wrong resourceType
8. GET reads not audited (PII, financial)
9. Audit category always 'association'
10. Split audit (Pino stdout vs table)
11. Silent audit failure (no dead-letter)
12. Audit data tamperable (no append-only protection)
13. E2E tests: no per-test isolation
14. Concurrent payment race condition untested
15. Admin app uses raw fetch, not SDK
16. No service layer
17. ~40% modules lack TypeSpec
18. audit module: 0 tests
19. email module: 0 tests
20. storage/documents: access control untested

### P3 — Nice to Improve (8)

1. CLAUDE.md consent JSONB claim (documented but unimplemented)
2. docs/ver-3 module specs lack testable acceptance criteria
3. Empty state UI coverage 10%
4. No full-text search indexes
5. No table partitioning for large tables
6. Stripe full refund flow deferred
7. ~15 test.todo stubs unimplemented
8. 0 frontend unit tests despite Vitest config

### Top 5 Most Dangerous

1. **2FA secrets plaintext** — DB compromise exposes every TOTP seed
2. **36% tables (26/72) not org-scoped** — Fundamental multi-tenant isolation failure
3. **castVote no validation** — Election integrity compromise
4. **Email verification disabled** — Healthcare professional impersonation
5. **Session tokens plaintext** — Combined with any DB leak = all sessions hijacked

---

## §14 Stabilization Plan

### Wave 1: P0 Security Fixes (Immediate)

| Item | What | Why | How |
|------|------|-----|-----|
| **1A** | Encrypt 2FA secrets | Plaintext secrets in `two_factor.secret` allow token extraction on DB breach | Add `secret_encrypted bytea` column, encrypt with libsodium, migrate existing secrets, update auth.ts. **Test first**: verify decryption roundtrip |
| **1B** | Encrypt session tokens | Plaintext `session.token`; leaks via breach | Add `token_hash varchar(255)` (SHA-256), update Better-Auth adapter. Force re-login after migration. **Test first**: session verification against hash |
| **1C** | Add organizationId to audit_log_entry | Cross-tenant audit data leakage | Add column + index + FK, update AuditService.logEvent() to capture orgId. **Test first**: verify queries filter by orgId |
| **1D** | Enforce email verification | `requireEmailVerification: false` allows unverified accounts | Set `requireEmailVerification: true` in auth.ts, verify email template generation. **Test first**: unverified user blocked from protected endpoints |
| **1E** | Validate uploadFile MIME types | No MIME allowlist; path traversal + XSS risk | Define allowlist, add validation before storage, sanitize filenames. **Test first**: blocked MIME types and malicious filenames |
| **1F** | Validate castVote input | `ctx.req.json()` accepts raw JSON with no schema | Add Zod schema with UUID validation, wire through zValidator. **Test first**: invalid inputs rejected |

### Wave 2: P1 Auth & RBAC Hardening

| Item | What | Why | How |
|------|------|-----|-----|
| **2A** | Enforce 2FA for privileged roles | No 2FA enforcement for admin/treasurer/president | Add check in officerAuthMiddleware. **Test first**: admin without 2FA → 403 |
| **2B** | Audit-log auth events | Login/logout/2FA not in audit trail | Add hooks in auth.ts createAuth(). **Test first**: verify logEvent called on login |
| **2C** | Secure internal service token | Untyped, no rotation, not audit-logged | Move to dedicated module, add rotation, hash storage. **Test first**: stale tokens rejected |
| **2D** | Fix officerAuth skip bug | Silently skips if no `:orgId` in route path | Throw 400 "Missing organization context" instead of skipping. **Test first**: 400 when orgId missing |
| **2E** | Session invalidation on role change | No invalidation when org role changes | Call `auth.invalidateUserSessions(userId)` after role update. **Test first**: old token rejected after role change |
| **2F** | Rate limit non-auth endpoints | Rate limiting only on Better-Auth routes | Add generic rate limiter middleware. **Test first**: request loop exceeding limit |

### Wave 3: P1 Audit & Testing Gaps

| Item | What | Why | How |
|------|------|-----|-----|
| **3A** | Add tests to audit module | Zero test coverage | Create org scoping, pagination, filter tests. Aim 80%+ |
| **3B** | Add tests to email module | Only 1 test exists | Queue, retry, template rendering, error handling tests |
| **3C** | Fix audit URL parsing | Wrong resourceType from URL segments | Use `ctx.req.routePath` or route-prefix map |
| **3D** | Audit GET operations | Read ops not audited (PII, financial) | Expand middleware for sensitive GET endpoints |
| **3E** | Unify comms modules | 3 overlapping modules | Audit which is active in OpenAPI, merge unused |

### Wave 4: P2 Structural Improvements

| Item | What | Why | How |
|------|------|-----|-----|
| **4A** | Implement service layer | Logic in handlers → repos directly | Create `/services/` directory, extract from top 3 modules |
| **4B** | TypeSpec migration for ~40% of handlers | Modules lack generated validators | Create .tsp files for 5 highest-risk modules |
| **4C** | Add missing DB indexes | stored_file has 0 indexes | Index frequently-queried columns |
| **4D** | Add unique constraints | memberNumber, licenseNumber lack uniqueness | Add org-scoped unique constraints |
| **4E** | Unify audit system | Pino stdout + DB table split | Route all events through unified AuditService |

---

## §15 Standards Adoption Plan

### Phase A: Documentation & Guardrails (1 week)

- [ ] Update CONTRIBUTING.md with mandatory testing pattern, handler file structure, security checklist
- [ ] Create ARCHITECTURE.md with middleware stack, handler anatomy, DB constraint rules
- [ ] Create docs/SECURITY.md with P0/P1/P2 checklists
- [ ] Create docs/TESTING.md with test patterns and minimum coverage targets (80% handlers, 100% critical paths)
- [ ] Create .github/PULL_REQUEST_TEMPLATE.md with security + test checklist

**Gate**: All 5 docs exist and reviewed. 0 PRs merged without passing tests.

### Phase B: Existing System Mapping (2 weeks)

- [ ] Module dependency map: docs/MODULE_DEPENDENCIES.md
- [ ] API coverage report: % routes with TypeSpec, % with tests, % with P0 fixes
- [ ] DB constraint audit: docs/DB_CONSTRAINTS.md
- [ ] Auth coverage matrix: docs/AUTH_COVERAGE.md
- [ ] Test coverage dashboard
- [ ] Risk heat map: docs/RISK_HEATMAP.md

**Gate**: All 6 docs complete. No more than 10% data missing/estimated.

### Phase C: Stabilization — Tests + P0/P1 Fixes (8 weeks)

- [ ] All P0 fixes from §14 Wave 1 complete and tested (6 items)
- [ ] All P1 fixes from §14 Wave 2 complete and tested (6 items)
- [ ] All P1 audit/test fixes from §14 Wave 3 complete (5 items)
- [ ] Test coverage: 80%+ of handler code (currently ~25%)
- [ ] Zero security gaps in P0/P1 risk matrix
- [ ] Audit table scoped to org
- [ ] Session rotation on role change
- [ ] Rate limiting active

**Gate**: All P0/P1 items complete. Test coverage >= 80%. Zero new P0/P1 introduced. No plaintext secrets in DB.

### Phase D: Spec Reconstruction (6 weeks)

- [ ] TypeSpec files for remaining ~40% of modules
- [ ] OpenAPI spec regenerated and validated against live API (0 mismatches)
- [ ] SDK regenerated (packages/sdk-ts/)
- [ ] All handlers wired through TypeSpec→routes pipeline
- [ ] Validator regeneration: Zod schemas auto-generated from TypeSpec

**Gate**: TypeSpec coverage = 100%. OpenAPI matches API within 99%. SDK builds correctly. No hand-wired routes except documented exceptions.

### Phase E: New Development Workflow (2 weeks + ongoing)

- [ ] Onboard 1st developer pair to new workflow
- [ ] Document 2-3 reference implementations (vertical slices)
- [ ] Update CONTRIBUTING.md with step-by-step workflow
- [ ] Create example: "Adding a new endpoint from scratch"

**Gate**: 3+ developers can independently add endpoint. 0 regressions. Zero security gaps in new code.

---

## §16 First 3 Vertical Slices

| Rank | Slice | Module | Why First | Risk | Days |
|------|-------|--------|-----------|------|------|
| 1 | 2FA Enforcement | `middleware:officer-auth` | Mandatory for privileged ops; small scope; unblocks payment flows | P1 | 3-4 |
| 2 | Audit Org Scoping | `handlers:audit` + `core:audit` | Critical for multi-tenancy; foundational for all other fixes | P0 | 4-5 |
| 3 | Upload Security | `handlers:storage` | Self-contained; fixes path traversal + XSS; demonstrates validation pattern | P0 | 2-3 |

### Slice 1: 2FA Enforcement (3-4 days)

1. **Test-first**: Create `officer-auth.test.ts` — admin without 2FA → 403, admin with 2FA → 200, regular member → 200, treasurer without 2FA → 403
2. **Implementation**: Update officer-auth.ts — add `isPrivilegedRole(role)`, check 2FA enabled
3. **Integration**: E2E test — register admin, disable 2FA, try sensitive endpoint, expect 403
4. **Audit**: Verify middleware logs 2FA denial to audit_log_entry
5. **Documentation**: Add to SECURITY.md

### Slice 2: Audit Org Scoping (4-5 days)

1. **Test-first**: Create `audit.test.ts` — log events for org-1 and org-2, verify isolation
2. **Schema migration**: Add `organizationId` column + index + FK
3. **Update AuditService**: Extract orgId from request context, pass to logEvent()
4. **Update middleware**: Ensure orgId from `ctx.get('organizationId')` available
5. **Integration**: Test castVote for different orgs, verify audit isolation

### Slice 3: Upload Security (2-3 days)

1. **Test-first**: Create `uploadFile.test.ts` — PDF ok, .html blocked, path traversal sanitized, XSS filename sanitized, size limit enforced
2. **Add validator**: MIME allowlist + filename sanitizer
3. **Update handler**: Validate mimeType, sanitize filename, check size, log to audit
4. **Integration**: E2E test upload PDF success, .exe rejection
5. **Documentation**: Add MIME allowlist and filename rules to SECURITY.md

---

## §17 Files to Create/Update

### Required (Blocks Further Development)

| File Path | Action | Why Required |
|-----------|--------|--------------|
| `ARCHITECTURE.md` | Create | Unifies architectural knowledge; required before refactoring |
| `docs/ver-3/HANDLER-MODULE-MAP.md` | Create | Resolves 22 handlers vs 19 PRD modules confusion |
| `docs/RBAC-ENDPOINT-SPEC.md` | Create | P1: needed before any endpoint modifies org data |
| `services/api-ts/TYPESPEC-COVERAGE.md` | Create | ~40% modules lack TypeSpec; blocks contract testing |
| `CLAUDE.md` | Update | Fix module count (22 not 9); fix consent JSONB claim; add P0/P1 risk summary |

### Recommended (Improves Quality Significantly)

| File Path | Action | Why Recommended |
|-----------|--------|-----------------|
| `docs/MULTI-TENANT-AUDIT.md` | Create | Centralizes 26/72 unscoped table remediation plan |
| `docs/ver-3/SECURITY-CHECKLIST.md` | Create | Pre-deployment security gates per P0/P1 |
| `docs/ver-3/business/modules/MODULE-SPEC-TEMPLATE.md` | Create | Standardizes future m20+ module specs |
| `docs/UX-SCREEN-MAPPING.md` | Create | Module→UX screen cross-reference; note 4 gaps |
| `docs/ver-3/ENDPOINT-SLICE-GUIDE.md` | Create | When to write slice specs vs module specs |
| `.planning/P0-P1-FIXES.md` | Create | Replaces scattered findings with executable roadmap |
| `docs/ver-3/AI-WORKFLOW.md` | Create | Claude Code skill recommendations per phase |

### Optional (Nice to Have)

| File Path | Action | Why Optional |
|-----------|--------|-------------|
| `docs/EXECUTION-CHECKLIST.md` | Consolidate | Move from docs/ver-3/ to root; add pre-sprint gates |
| `docs/HANDLER-ONBOARDING.md` | Create | Step-by-step new handler module setup |
| `docs/TESTING-MATRIX.md` | Create | Per-handler unit/integration/E2E expectations |
| `.planning/KNOWLEDGE-TRANSFER.md` | Create | Onboarding guide for new team members |

---

## §18 Final Recommendations

### Do Now (This Week)

1. **Fix CLAUDE.md inaccuracies** — change module claim from "9" to "22 handler dirs"; remove consent JSONB claim; add P0/P1 risk summary
2. **Create ARCHITECTURE.md** — Monobase structure, app ports, deployment topology, middleware stack
3. **Create HANDLER-MODULE-MAP.md** — 22 handler dirs mapped to 19 PRD modules with TypeSpec coverage %
4. **Audit multi-tenant tables** — extract all 72 tables, identify 26 without org scoping, create test cases
5. **Create P0-P1 remediation roadmap** — sequence 7 P0 + 11 P1 fixes with dependencies and effort estimates

**Gate**: All 5 completed before new feature development.

### Do Next (2-4 Weeks)

1. TypeSpec coverage push — inventory, create stubs, add CI check
2. RBAC endpoint audit — verify org-scope checks for all 550+ endpoints
3. Security checklist integration — before-deploy gate in CONTRIBUTING.md
4. MODULE-SPEC-TEMPLATE + UX-SCREEN-MAPPING — standardize and catalog
5. AI-WORKFLOW guide — document which Claude Code skills per development phase

### Do Later (Backlog)

1. ENDPOINT-SLICE-GUIDE — when to slice vs. spec
2. HANDLER-ONBOARDING — script/template for m20+ modules
3. TESTING-MATRIX — formalize test expectations
4. KNOWLEDGE-TRANSFER — onboarding guide
5. Consolidate EXECUTION-CHECKLIST to root

### Avoid (Anti-Patterns)

1. **Don't rewrite the whole app.** Monobase template is solid; fix P0/P1 risks in-place with surgical PRs.
2. **Don't move all folders.** Document current structure first (ARCHITECTURE.md); restructure only if audit explicitly recommends.
3. **Don't treat UI mockups as product truth.** Use business rules and module specs to drive implementation.
4. **Don't build new features before P0/P1s are addressed.** Gate: P0/P1 fixes ≥50% complete before m20 starts.
5. **Don't create slice specs for complex modules without module specs.** m12 (elections), m19 (committees), m11 (documents) need full module spec first.
6. **Don't code directly from giant PRDs.** Use module specs as coding source of truth.
7. **Don't skip multi-tenant scoping checks for "utility handlers."** audit, email, comms can leak org data.
8. **Don't add new endpoints without TypeSpec.** 8 inline routes exist; don't create more. Add CI check.
9. **Don't deploy without running the security checklist.** Every P0/P1 fix validated against secrets, validation, scope, audit, rate limiting, role gates.

### Strengths to Preserve

1. **VERTICAL_TDD discipline** — test-first development, clear separation of concerns, 250 test files as quality baseline
2. **Centralized error handling (14 types)** — well-designed error layer. Extend, don't add ad-hoc codes
3. **Monobase template leverage** — account, admin, memberry share api-ts cleanly. Don't couple
4. **PRD-driven development** — docs/ver-3/ has 33 files of business domain knowledge. Rare and valuable
5. **TypeScript + Drizzle + Better-Auth stack** — type safety at DB layer prevents injection. Don't introduce dynamic queries
6. **17 Claude Code skills** — domain-specific task automation. Keep CONTRIBUTING.md reference accurate
7. **docs/ver-3/ organization by business domain** — business/ and ux/ split is clear. Expand while keeping structure

---

*Generated by deep codebase audit across 6 phases. All P0 findings verified against source code. Counts verified: 22 handler dirs, 72 tables (29 schema files), ~550 endpoints (2493-line routes.ts + 24 hand-wired), ~245 test files (154 backend + 42 Hurl + 49 E2E), 14/14 key file paths confirmed.*
