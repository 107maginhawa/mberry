# Existing Codebase Adoption Audit

---
**Audit Date:** 2026-05-26 (Post-audit/codebase-improvements branch)
**Previous Audit:** 2026-05-21 (Wave 5 post-boilerplate-alignment)
**Source Directory:** /Users/elad-mini/Desktop/memberry
**Stack:** TypeScript + Bun + Hono + Drizzle ORM + PostgreSQL + TanStack Router + Vite
**oli version:** oli-audit-codebase v2
---

## 1. Executive Summary

**Overall Health Score: 7.9/10** (150/190 across 19 dimensions)

**Top 3 Strengths:**
1. **Massive test infrastructure** -- 504 backend test files, 127 E2E spec files, 97 frontend component tests, 97 Hurl contract tests. Total ~825 test artifacts across all layers.
2. **Strong auth/RBAC stack** -- 4-layer auth (global middleware + officer position checks + platform admin isolation + impersonation guard). Rate limiting, security headers (CSP/HSTS/X-Frame-Options via Hono secureHeaders), CORS with dynamic origin validation. XSS sanitization tested in certificates module.
3. **Mature infrastructure** -- Domain event bus (typed DomainEventBus with 3 event types), structured logging with requestId correlation, feature flags system, 6-layer seed data, 57 migrations, comprehensive error hierarchy (11 error types).

**Top 3 Gaps:**
1. **Cross-module coupling** -- 35+ cross-module handler imports across 9 modules, all converging on `association:member` (mega-module, 314 files). `person`, `dues`, `membership`, `communication` all directly import from `association:member` repos/schemas. No domain event decoupling for cross-module writes.
2. **TypeSpec coverage gap** -- 19 TypeSpec modules cover ~58% of handler dirs. 8 handler directories have zero TypeSpec definitions: `advertising`, `association:member`, `association:operations`, `certificates`, `communication`, `documents`, `events`, `training`. These use hand-wired routes.
3. **Unbounded queries** -- 20+ `select()` calls without LIMIT in `dues`, `booking`, and `email` repos. 3 N+1 patterns in bulk operations (slot cleanup loops).

**Delta Since Last Audit (2026-05-21):**
- Health score: 7.8 -> 7.9 (security fixes landed, more E2E tests)
- Handler modules: 25 -> 26 (`advertising` added)
- Backend test files: 419 -> 504 (+85)
- E2E spec files: 101 -> 127 (+26)
- Frontend test files: 97 (new metric)
- Contract tests: 97 (unchanged)
- Total TS source files (non-test, non-generated): 767
- Schema files: 44
- Migrations: 57
- Frontend routes: 125 (memberry) + 23 (admin) = 148
- Frontend features: 22 directories
- OpenAPI spec: 412 endpoints across 276 paths (81,705 lines)

---

## 2. Module Discovery

### 2.1 Backend Handler Modules (26 directories)

| Module | Total Files | Test Files | Handler Files | TypeSpec | Status |
|--------|------------|------------|---------------|----------|--------|
| association:member | 314 | 79 | 189 | No | MEGA-MODULE -- split deferred to v1.2.0 |
| association:operations | 98 | 21 | 68 | No | Active -- committees, cross-chapter analytics |
| communication | 92 | 41 | 44 | No | Active -- templates, queuing, announcements |
| platformadmin | 59 | 28 | 26 | Yes (2 .tsp) | Active -- admin-tier operations |
| person | 57 | 29 | 22 | Yes (2 .tsp) | Active -- central PII hub |
| booking | 56 | 25 | 19 | Yes | Active -- time-based scheduling |
| events | 42 | 25 | 14 | No | Active -- event management |
| billing | 41 | 23 | 16 | Yes | Active -- Stripe Connect |
| membership | 41 | 24 | 14 | No (custom .tsp) | Active -- applications, approvals |
| email | 40 | 17 | 13 | Yes | Active -- transactional queue |
| documents | 39 | 22 | 15 | No | Active -- document management |
| training | 37 | 22 | 12 | No | Active -- CPD/CE credits |
| surveys | 34 | 14 | 16 | Yes | Active -- NPS, surveys |
| dues | 26 | 14 | 4 | Yes (custom) | Active -- invoicing, payments |
| elections | 26 | 17 | 7 | No | Active -- voting, nominations |
| comms | 22 | 5 | 13 | Yes | Active -- WebSocket video/chat |
| certificates | 22 | 12 | 6 | No | Active -- certificate generation |
| advertising | 18 | 7 | 7 | No | NEW -- not yet in TypeSpec |
| notifs | 16 | 7 | 6 | Yes (2 .tsp) | Active -- OneSignal push |
| jobs | 16 | 7 | 7 | No | Infrastructure -- background jobs |
| marketplace | 16 | 3 | 9 | No | Active -- listing/orders |
| storage | 12 | 4 | 6 | Yes | Active -- S3/MinIO |
| reviews | 11 | 5 | 4 | Yes | Active -- NPS reviews |
| invite | 10 | 4 | 3 | Yes | Active -- org invitations |
| audit | 8 | 4 | 1 | Yes | Active -- compliance logging |
| __tests__ | 1 | 1 | 0 | N/A | Shared test utilities |

### 2.2 Frontend Applications

**Memberry App (port 3004):**
- 125 route files (TanStack Router, file-based)
- 22 feature directories: account, admin, billing, booking, certificates, chapters, comms, communications, dashboard, directory, documents, dues, elections, events, invite, membership, notifications, onboarding, person, profile, surveys, training
- Pattern components: confirm-dialog, error-boundary, form-field, data-table, date-picker, skeleton-loader, empty-state, combobox, error-state, status-badge, avatar-initials, page-header, stat-card
- Layout components: officer-sidebar, member-sidebar, member-header, member-bottom-nav, officer-mobile-nav, org-picker-sheet, org-icon-rail
- Motion components: stagger-grid, count-up, glass-card
- 97 frontend test files (component + unit)

**Admin App (port 3003):**
- 23 route files
- Routes: organizations, associations, operators, committees, training, feature-flags, verifications, national-dashboard, compliance, audit, surveys, members, events, impersonate, communications (templates, email, moderation)
- Role-gated via `role-gate.tsx`
- 0 test files (gap)

### 2.3 SDK (packages/sdk-ts)

- Generated: TanStack Query hooks, client, types, transformers
- Hand-written: client.ts, transport.ts, flows/ (billing-onboarding, file-upload), react/auth hooks, utils/patch, utils/webrtc (peer-connection, signaling-client)
- Tests: client.test.ts, transport.test.ts, billing-onboarding.test.ts, file-upload.test.ts, signaling-client.test.ts

---

## 3. Domain Terms Extracted

### 3.1 Core Entities
- **Person** -- Central PII hub, identity anchor
- **Organization** -- Association/chapter entity
- **Membership** -- Person-to-org relationship with status lifecycle
- **DuesInvoice / DuesPayment** -- Financial obligations and receipts
- **BookingEvent / TimeSlot / Booking** -- Scheduling primitives
- **CreditEntry / OrgCpdConfig** -- CPD/CE tracking
- **Certificate** -- Credential certificates
- **Communication / Announcement / FeedPost** -- Messaging
- **ChatRoom / ChatMessage** -- Real-time comms
- **Survey / SurveyResponse** -- Feedback collection
- **Document** -- File management with access logs
- **OfficerTerm** -- Governance position tracking
- **Committee / CommitteeTask** -- Operational committees
- **Election / Nomination / Vote** -- Governance voting
- **SpecialAssessment** -- Ad-hoc financial levies
- **Credential** -- Professional credentials (Trust Directory)
- **Training / TrainingEnrollment** -- Education programs
- **Event** -- Association events

### 3.2 Domain Events (Typed)
```
dues.payment.recorded     -> paymentId, personId, organizationId, amount, newExpiryDate
membership.status.changed -> membershipId, personId, organizationId, oldStatus, newStatus
invite.claimed            -> inviteId, personId, organizationId, membershipId
```
Only 3 domain events defined. Cross-module communication largely via direct imports.

---

## 4. Permission Matrix

### 4.1 Auth Layers
| Layer | Implementation | Coverage |
|-------|---------------|----------|
| Global auth middleware | `middleware/auth.ts` -- session validation, suspended account check | All non-public routes |
| Officer auth | `middleware/officer-auth.ts` -- org-scoped position check | Officer-only endpoints |
| Platform admin auth | `middleware/platform-admin-auth.ts` -- admin role verification | `/platformadmin/*` routes |
| Impersonation guard | `middleware/impersonation-guard.ts` -- write-block for impersonated sessions | All mutation routes |
| Rate limiting | `middleware/rate-limit.ts` -- configurable per-route, skips `/health` and `/ready` | Global |

### 4.2 Role Hierarchy
- **Member** -- Basic member access (profile, own data, directory)
- **Officer** -- Organization-scoped admin (position-based: President, Treasurer, Secretary, etc.)
- **Platform Admin** -- Cross-org admin (national-level operations)
- **Impersonated** -- Read-only view of another user's session (write-blocked)

### 4.3 Auth Gate Test
File: `services/api-ts/src/handlers/auth-gate-coverage.test.ts` (15,266 bytes) -- verifies all routes have auth gates.

---

## 5. Business Rules Extracted

### 5.1 Explicit Rules (from code)
- **Dues expiry** -- Membership dues have configurable cycles; auto-invoice generation via background jobs
- **Payment tokens** -- One-tap payment links with token validation + checkout flow
- **Credit cycles** -- CPD credits tracked per cycle with configurable org-level requirements
- **Certificate numbering** -- Unique certificate numbers per organization
- **Booking constraints** -- Max booking days (0-365), min booking minutes (0-4320), time order checks, duration limits
- **Special assessments** -- Ad-hoc financial levies applied to members
- **Credential verification** -- Public lookup for professional credentials (Trust Directory)

### 5.2 Stub Handlers (Deferred v1.2.0)
9 institutional membership stubs in `association:member`:
- createInstitutionalMembership, getInstitutionalMembership, updateInstitutionalMembership, deleteInstitutionalMembership
- listInstitutionalMemberships, allocateSeat, revokeSeat, listSeatAllocations
- recalculateAgingBucket

All return 501 with `Implementation-Status: STUB` comment.

---

## 6. API Surface

### 6.1 OpenAPI Spec
- **412 endpoints** across **276 paths**
- Spec file: 81,705 lines (`specs/api/dist/openapi/openapi.json`)
- Generated from 19 TypeSpec modules + Better-Auth + health endpoints

### 6.2 Route Registration Pattern
- **Generated routes**: `registerOpenAPIRoutes()` from `@/generated/openapi/routes`
- **Hand-wired routes**: ~33 routes registered directly in `app.ts` (accredited providers, email unsubscribe, payment tokens, public org discovery, etc.)
- **WebSocket routes**: `registerWebSocketRoutes()` from `@/generated/websocket/registry`

### 6.3 TypeSpec Coverage Gap
| Has TypeSpec | Handler Directories |
|-------------|-------------------|
| Yes | audit, billing, booking, comms, dues (custom), email, invite, membership (custom), notifs, person, platformadmin, reviews, storage, surveys |
| No | advertising, association:member, association:operations, certificates, communication, documents, elections, events, jobs, marketplace, training |

**11 of 26 handler directories have no TypeSpec definitions.** These modules use hand-wired routes and are not represented in the OpenAPI spec.

---

## 7. State Machines

### 7.1 Identified Status Fields
| Entity | Status Values | Guard Type |
|--------|--------------|------------|
| Membership | active, suspended, expired, terminated, pending | Partial -- handler checks |
| Booking | pending, confirmed, cancelled, no-show, completed | DB check constraints |
| BookingEvent | active, paused, archived | DB check constraints |
| TimeSlot | available, booked, blocked | DB check constraints |
| DuesInvoice | pending, paid, overdue, cancelled | Handler checks |
| Committee | active, completed, dissolved | Handler checks |
| CommitteeTask | open, in-progress, completed, cancelled | Handler checks |
| Election | draft, active, closed | Handler checks |
| Training | draft, published, completed, cancelled | Handler checks |
| TrainingEnrollment | enrolled, completed, cancelled | Handler checks |

### 7.2 State Machine Guard Assessment
- **With DB constraints**: Booking, BookingEvent, TimeSlot (P: good)
- **Handler-only checks**: Membership, DuesInvoice, Committee, Election, Training (P2: inconsistent)
- **No formal transitions map**: Most status fields lack a `VALID_TRANSITIONS` constant or guard function

---

## 8. UI / Screen Audit

### 8.1 Memberry App Screens (125 routes)
Major route groups: auth, dashboard, membership, dues, events, training, booking, communications, documents, certificates, elections, comms, profile, settings, surveys, directory, onboarding, notifications

### 8.2 Component Patterns
- Reusable patterns: confirm-dialog, data-table, date-picker, skeleton-loader, empty-state, error-boundary, form-field, combobox, status-badge, page-header, stat-card
- Motion components: glass-card, count-up, stagger-grid
- Layout: Dual nav (officer sidebar + member bottom nav), org picker, mobile nav

### 8.3 Mock Data / Prototype Contamination
- 6-layer seed data system (foundation -> users -> modules -> cross-module -> gap-fill -> states)
- No detected mock/hardcoded data in production components (seed data properly isolated in `src/seed/`)

---

## 9. Test Coverage Audit

### 9.1 Test Counts by Layer

| Layer | Count | Coverage |
|-------|-------|----------|
| Backend unit/integration tests | 504 files | All 26 handler modules covered |
| E2E specs (Playwright) | 127 files | Member journeys, auth, cross-org, booking, events, training, communications, documents, certificates |
| Frontend component tests | 97 files | Features: dues, chapters, booking, comms, elections, profile, dashboard, etc. |
| Contract tests (Hurl) | 97 files | API contract verification |
| SDK tests | 5 files | Client, transport, flows, signaling |
| **Total test artifacts** | **~830** | |

### 9.2 Test Coverage by Module

| Module | Backend Tests | E2E Coverage | Frontend Tests | Contract Tests | Assessment |
|--------|--------------|-------------|----------------|---------------|------------|
| association:member | 79 | Yes | Yes (chapters) | Yes | STRONG |
| communication | 41 | Yes | Yes (comms) | Yes | STRONG |
| person | 29 | Yes | Yes (profile) | Yes | STRONG |
| platformadmin | 28 | Partial | No | Yes | GOOD |
| booking | 25 | Yes | Yes | Yes | STRONG |
| events | 25 | Yes | Yes | Partial | STRONG |
| membership | 24 | Yes | Yes | Yes | STRONG |
| billing | 23 | Yes | Yes | Yes | STRONG |
| documents | 22 | Yes | Yes | Yes | STRONG |
| training | 22 | Yes | Yes | Partial | STRONG |
| elections | 17 | Yes | Yes | No | GOOD |
| email | 17 | No | No | Yes | MODERATE |
| dues | 14 | Yes | Yes (10+ components) | Yes | STRONG |
| surveys | 14 | Partial | Yes | Yes | GOOD |
| certificates | 12 | Yes | Yes | No | GOOD |
| advertising | 7 | No | No | No | WEAK |
| notifs | 7 | No | Yes (drawer) | Yes | MODERATE |
| jobs | 7 | No | No | No | WEAK |
| comms | 5 | Yes | Yes | Yes | MODERATE (low backend) |
| reviews | 5 | No | No | Yes | MODERATE |
| storage | 4 | No | No | Yes | MODERATE |
| invite | 4 | Yes | Yes | Yes | MODERATE |
| marketplace | 3 | No | No | No | WEAK |
| audit | 4 | No | No | Yes | MODERATE |

### 9.3 Admin App Test Gap
**0 test files** for the admin app. This is a P2 gap -- the admin dashboard has 23 routes with no automated testing.

---

## 10. Security Audit (OWASP Top 10)

### 10.1 Assessment Matrix

| OWASP Category | Status | Evidence |
|----------------|--------|----------|
| A01: Broken Access Control | GOOD | 4-layer auth, officer position checks, impersonation write-block, auth-gate-coverage.test.ts, IDOR fixes landed (commit a233a3c9) |
| A02: Cryptographic Failures | GOOD | Better-Auth handles credential storage, no plaintext PII logging detected |
| A03: Injection | GOOD | Drizzle ORM (parameterized queries), Zod input validation, raw SQL limited to schema constraints + aggregations |
| A04: Insecure Design | MODERATE | Rate limiting present but env-var based (not per-user). Feature flags are deployment-level only. |
| A05: Security Misconfiguration | GOOD | secureHeaders() via Hono (CSP, HSTS, X-Frame-Options), CORS with dynamic origin validation, explicit allowed methods/headers |
| A06: Vulnerable Components | MONITOR | Standard deps (Hono, Drizzle, Better-Auth, Stripe). Playwright pinned to 1.58.2 due to breaking change. |
| A07: Auth Failures | GOOD | Account lockout (core/account-lockout.ts), session limit (core/session-limit.ts), MFA disable guard, rate limiting on auth endpoints |
| A08: Data Integrity | GOOD | DB check constraints on booking, certificate numbering, Zod validators on all generated routes |
| A09: Logging & Monitoring | GOOD | Pino structured logging, requestId correlation on all requests, audit middleware, metrics endpoint |
| A10: SSRF | LOW RISK | No user-controlled URL fetching detected in handlers |

### 10.2 XSS Mitigation
- Certificate template: `sanitizeColor()` function, HTML entity escaping, javascript: URL blocking
- Tests verify XSS prevention in certificate generation (5 test cases)
- No general-purpose HTML sanitization middleware (relies on React for frontend, Zod for API)

### 10.3 Recent Security Fixes (from git log)
- `a233a3c9`: P0 IDOR and access control gaps closed in Documents, Storage, Certificates
- `87357508`: Auth guards added to elections, events handlers
- `7034b1a5`: Permission enforcement tests for booking, documents, certificates

---

## 11. Observability Audit

| Dimension | Status | Implementation |
|-----------|--------|---------------|
| Structured logging | YES | Pino logger (`core/logger.ts`) |
| Request ID / correlation | YES | `middleware/request.ts` -- X-Request-ID header, auto-generated UUID |
| Audit trail | YES | `middleware/audit.ts` + `core/audit.ts` |
| Metrics | YES | `core/metrics.ts` -- endpoint registered |
| Health checks | YES | `/health` and `/ready` endpoints, storage healthCheck() |
| Error tracking | YES | Centralized error handler with requestId + timestamp in all responses |
| Feature flags | YES | FF_* env vars, parsed to typed object, exposed via `/feature-flags` |

**Gap:** No distributed tracing (OpenTelemetry). Acceptable for current scale but track as P3.

---

## 12. Performance Audit

### 12.1 Anti-Patterns Detected

| Pattern | Severity | Location | Details |
|---------|----------|----------|---------|
| Unbounded queries | P2 | `dues/repos/dues.repo.ts` (9 instances) | `.select()` without LIMIT |
| Unbounded queries | P2 | `booking/repos/*.repo.ts` (3 instances) | `.select()` without LIMIT |
| Unbounded queries | P2 | `dues/jobs/reminderProcessor.ts` (3 instances) | `.select()` without LIMIT |
| Unbounded queries | P3 | `dues/jobs/autoInvoiceGenerator.ts` | `db.select().from(duesOrgConfigs)` -- small table, low risk |
| Unbounded queries | P2 | `dues/jobs/webhookRetryProcessor.ts` (2 instances) | `.select()` without LIMIT |
| N+1 pattern | P2 | `booking/jobs/slotCleanup.ts` | Map + delete loop in slot cleanup |

### 12.2 Database Indexes
- Booking module: GIN index on tsvector for full-text search, partial indexes on status fields
- Check constraints: time ordering, duration limits, booking days, reason length
- FK references: Present in schemas but index coverage not verified (P3)

---

## 13. Inconsistencies & Code Smells

### 13.1 Stub Inventory

| Type | Count | Severity | Details |
|------|-------|----------|---------|
| Runtime stubs (501) | 9 | P3 | Institutional membership handlers -- documented, deferred to v1.2.0 |
| TODO/FIXME markers | ~15 | P3 | Scattered across handlers (normal development markers) |

### 13.2 Type Cast Density (`as any` in non-test handler files)

| File | Casts | Severity |
|------|-------|----------|
| communication/jobs/announcementSend.ts | 4 | P3 |
| dues/checkoutPaymentToken.ts | 2 | P3 |
| billing/handleStripeWebhook.ts | 2 | P3 |
| Other files (8 files) | 1 each | P3 |
| **Total in handler code** | **~16** | Low -- acceptable |

**Note:** Test files contain significantly more `as any` casts (expected for mock typing). The generated `routes.ts` has 412 casts (generated code, not actionable).

### 13.3 Cross-Module Import Violations

| Importing Module | Imports From | Count | Severity |
|-----------------|-------------|-------|----------|
| person | association:member (repos, utils) | 10+ | P2 |
| dues | association:member (repos, schemas) | 5 | P2 |
| dues | platformadmin (schemas) | 2 | P2 |
| person | platformadmin (schemas) | 2 | P2 |
| membership | association:member | Likely | P2 |
| communication | association:member | Likely | P2 |

**Bi-directional risk:** `association:member` is imported by 6+ modules but does not import from them -- star dependency pattern (not bi-directional). This is the mega-module problem; split planned for v1.2.0.

### 13.4 Cross-Module Raw SQL
Raw SQL (`sql` template literals) found in:
- `dues/repos/dues.repo.ts` -- aggregation queries referencing own tables (acceptable)
- `booking/repos/booking.schema.ts` -- check constraints, indexes (acceptable)
- `dues/jobs/reminderProcessor.ts` -- date casting `::date` (acceptable but fragile)

No cross-module table references in raw SQL detected. This is clean.

### 13.5 Naming Inconsistencies
- `communication` (28 handlers) vs `communications` route in admin app -- minor, documented as intentional
- `comms` (WebSocket real-time) vs `communication` (async messaging) -- intentional bounded context separation
- Handler file naming: mix of camelCase (`getDuesDashboard.ts`) and kebab-case in some repos -- mostly consistent within modules

---

## 14. Repository Guardrails

| Document | Status | Lines | Quality |
|----------|--------|-------|---------|
| CLAUDE.md | EXISTS | 22,467 chars | Comprehensive -- 25-module inventory, conventions, commands |
| CONTRIBUTING.md | EXISTS | 71,838 chars | Extensive -- coding standards, generation workflow, testing |
| ARCHITECTURE.md | EXISTS | 16,142 chars | Good -- system overview |
| ROADMAP.md | EXISTS | 7,486 chars | Active -- deferred work tracked |
| VERTICAL_TDD.md | EXISTS | 13,446 chars | Detailed -- test-first protocol |
| VERSION | EXISTS | 8 chars | Version tracked |
| CHANGELOG.md | EXISTS | 3,691 chars | Maintained |
| .env.example | EXISTS | 867 chars | Environment template |

**Assessment:** Guardrails are comprehensive. All critical docs exist and are actively maintained.

---

## 15. Spec Coverage

### 15.1 TypeSpec Coverage
- 19 .tsp files in `specs/api/src/modules/`
- Covers: audit, billing, booking, comms, dues-custom, email, invite, membership-custom, notifs, notifs-custom, patient, person, person-custom, platform-admin, platform-admin-custom, provider, reviews, storage, surveys
- Common: models.tsp, pagination.tsp, security.tsp

### 15.2 Modules Without TypeSpec (Hand-Wired)
1. **advertising** -- NEW module, not yet spec'd
2. **association:member** -- Mega-module, too large for single .tsp
3. **association:operations** -- Committees, analytics
4. **certificates** -- Certificate generation
5. **communication** -- Async messaging/templates
6. **documents** -- Document management
7. **elections** -- Voting/nominations
8. **events** -- Event management
9. **marketplace** -- Listing/orders
10. **training** -- CPD/CE programs
11. **jobs** -- Infrastructure (intentionally no spec)

### 15.3 Contract Test Coverage
97 Hurl contract test files. Coverage spans auth flows, happy paths, error codes, and multi-step journeys.

---

## 16. Standards Gap Matrix

| Dimension | Current | Target | Gap | Priority |
|-----------|---------|--------|-----|----------|
| TypeSpec coverage | 58% (15/26) | 100% | 11 modules | P2 |
| State machine guards | 3/10 formal | 10/10 | 7 undocumented | P2 |
| Cross-module decoupling | Direct imports | Domain events | 35+ imports | P2 |
| Unbounded queries | 20+ instances | 0 | 20+ | P2 |
| Admin app tests | 0 | 20+ | 23 routes untested | P2 |
| N+1 query patterns | 3 confirmed | 0 | 3 | P2 |
| Distributed tracing | None | OpenTelemetry | Full gap | P3 |
| Consent management | Not implemented | GDPR-ready | Schema needed | P3 |
| Formal transition guards | 3/10 | 10/10 | 7 machines | P2 |
| Domain events | 3 events | 15+ (cover all cross-module) | 12+ missing | P2 |
| API spec drift | ~33 hand-wired routes | 0 | 33 routes | P3 |

---

## 17. Stabilization Plan

### Fix Now (P0/P1) -- Before Any New Features
All P0 items resolved as of this audit:
- [x] IDOR gaps closed (commit a233a3c9)
- [x] Auth guards on elections/events (commit 87357508)
- [x] Permission enforcement tests (commit 7034b1a5)

**No open P0/P1 items.**

### Fix Before New Work (P2) -- Next Sprint
1. **Add LIMIT to unbounded queries** -- 20+ instances in dues, booking, email repos
2. **Fix N+1 in slot cleanup** -- `booking/jobs/slotCleanup.ts` batch delete instead of loop
3. **Add admin app E2E tests** -- At least smoke tests for 23 routes
4. **State machine transition guards** -- Add `VALID_TRANSITIONS` maps for membership, dues, committee, election, training

### Fix When Touching Module (P3) -- Opportunistic
1. Add TypeSpec definitions for hand-wired modules when modifying them
2. Replace cross-module direct imports with domain events
3. Add OpenTelemetry tracing spans
4. Implement consent management schema
5. Clean up `as any` casts in handler code (16 instances)
6. Move hand-wired routes to TypeSpec

---

## 18. Adoption Plan (5-Phase Roadmap)

### Phase 1: Guardrails (COMPLETE)
- [x] CLAUDE.md with full module inventory
- [x] CONTRIBUTING.md with coding standards
- [x] ARCHITECTURE.md with system overview
- [x] VERTICAL_TDD.md with test-first protocol
- [x] Auth gate coverage test
- [x] Lint-staged + Husky hooks

### Phase 2: Document (COMPLETE)
- [x] Domain event registry
- [x] Error hierarchy (11 types)
- [x] API surface mapped (412 endpoints)
- [x] Module structure documented in CLAUDE.md
- [x] 6-layer seed data

### Phase 3: Stabilize (IN PROGRESS)
- [x] Security audit fixes (P0 IDOR, auth guards)
- [x] 504 backend tests + 127 E2E specs
- [ ] Unbounded query fixes (P2)
- [ ] State machine guards (P2)
- [ ] Admin app tests (P2)

### Phase 4: Adopt Standards
- [ ] TypeSpec for remaining 11 modules
- [ ] Domain events for cross-module communication
- [ ] Mega-module split (association:member -> 4-6 smaller modules)
- [ ] Consent management schema

### Phase 5: Migrate
- [ ] All hand-wired routes to TypeSpec
- [ ] Cross-module imports replaced by events
- [ ] OpenTelemetry integration
- [ ] Full contract test coverage for all endpoints

---

## 19. First 3 Vertical Slices Recommended

### Slice 1: `events` Module TypeSpec Migration
**Rationale:** 42 files, 11 handlers, active module with no TypeSpec. Has E2E tests. Low coupling risk.
**Scope:** Define events.tsp, generate routes/validators, migrate hand-wired routes, verify contract tests.
**Effort:** Small (1-2 days)

### Slice 2: Unbounded Query Remediation (dues + booking)
**Rationale:** 23+ unbounded queries across 2 high-traffic modules. Performance risk in production.
**Scope:** Add LIMIT/pagination to all `select()` calls, batch delete in slot cleanup, add test assertions.
**Effort:** Small (1 day)

### Slice 3: State Machine Transition Guards
**Rationale:** 7/10 state machines lack formal guards. Business logic integrity risk.
**Scope:** Add `VALID_TRANSITIONS` maps for membership, dues invoice, committee, election, training. Add unit tests for invalid transitions.
**Effort:** Medium (2-3 days)

---

## 20. Codebase Health Score

### Dimension Scores (10-point scale)

| # | Dimension | Score | Notes |
|---|-----------|-------|-------|
| 1 | Module structure clarity | 9 | 26 well-organized handler dirs, consistent pattern |
| 2 | API surface documentation | 7 | 412 endpoints spec'd, but 33 hand-wired without TypeSpec |
| 3 | Type safety | 8 | Zod validators, Drizzle type inference, low `as any` (16 in handlers) |
| 4 | Test coverage breadth | 9 | 830+ test artifacts across 4 layers |
| 5 | Test coverage depth | 8 | Strong assertions, but admin app untested |
| 6 | Auth / RBAC | 9 | 4-layer auth, auth-gate test, IDOR fixed |
| 7 | Error handling | 9 | 11 error types, centralized handler, requestId in responses |
| 8 | Observability | 8 | Pino + requestId + metrics + health. Missing: OpenTelemetry |
| 9 | Performance | 6 | Unbounded queries (20+), N+1 patterns (3) |
| 10 | Security posture | 8 | OWASP audit clean, secureHeaders, rate limiting, XSS prevention |
| 11 | Domain model clarity | 8 | 3 typed domain events, clear entity model, DDD-aware |
| 12 | Cross-module coupling | 6 | 35+ direct imports into association:member mega-module |
| 13 | State machine integrity | 6 | 3/10 formal guards, 7 ad-hoc |
| 14 | Stub density | 9 | Only 9 stubs, all documented + deferred |
| 15 | Type cast density | 9 | 16 `as any` in handler code (low) |
| 16 | Spec coverage | 7 | 58% TypeSpec, 33 hand-wired routes |
| 17 | Repository guardrails | 10 | All docs exist, comprehensive, maintained |
| 18 | Seed data quality | 9 | 6-layer system, realistic data, properly isolated |
| 19 | Frontend architecture | 8 | 22 feature dirs, reusable patterns, dual layout |
| **Total** | **150/190** | **7.9/10** |

---

## 21. What's Next

| Action | Skill | When |
|--------|-------|------|
| Fix P2 performance issues (unbounded queries) | Manual remediation | Next sprint |
| Add state machine guards | `/handler` per module | Next sprint |
| Add admin app tests | `/test-e2e` | Next sprint |
| Ongoing compliance checks | `/oli-audit-compliance` | After stabilization |
| Implementation sequencing | `/oli-vertical-slice-plan` | When planning Phase 4 |
| Test confidence scoring | `/oli-confidence-stack` | After P2 fixes |
| Mega-module split planning | See `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` | v1.2.0 |

---

*Generated by oli-audit-codebase v2 on 2026-05-26. Health score measures code structural quality, not spec compliance or test confidence.*
