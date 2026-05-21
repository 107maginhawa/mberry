# Existing Codebase Adoption Audit

---
**Audit Date:** 2026-05-21 (Wave 5 — post-boilerplate-alignment re-baseline)
**Previous Audit:** 2026-05-20 (Wave 4 deep refresh)
**Source Directory:** /Users/elad-mini/Desktop/memberry
**Stack:** TypeScript + Bun + Hono + Drizzle ORM + PostgreSQL + TanStack Router + Vite
**oli version:** oli-audit-codebase v1
---

## 1. Executive Summary

**Overall Health: 7.8/10** (148/190 across 19 dimensions)

**Top 3 Strengths:**
1. **Comprehensive test coverage** — 419 backend test files with 91%+ strong assertions, 101 E2E tests, 97 Hurl contract tests across 25 handler modules. 100% module coverage.
2. **Strong auth/RBAC** — 4-layer auth stack (global middleware + officer position checks + 2FA for privileged roles + platform admin isolation); zero unguarded mutations; IDOR prevention tested.
3. **Full spec coverage** — 16/16 PRD artifacts exist, 19/19 module specs, DOMAIN_MODEL.md (1575 lines, 11 bounded contexts), zero terminology conflicts in glossary.

**Top 3 Gaps:**
1. **State machine guard gaps** — Only 3/10 documented state machines have formal `VALID_TRANSITIONS` guards. 7 rely on ad-hoc handler checks. 11 additional undocumented pgEnums with zero guards.
2. **Cross-module coupling** — 3 bi-directional import cycles (all involving `association:member`), 35 cross-module imports across 9 modules. No event bus — cross-module effects via direct imports.
3. **Performance anti-patterns** — 15 unbounded `findMany` queries without LIMIT, 3 confirmed N+1 patterns in bulk operations, 2 missing FK indexes.

**Delta Since Last Audit (2026-05-20 Wave 4):**
- Health score: 8.2 → 7.8 (stricter re-baseline with deeper cross-module + performance analysis)
- Handler modules: 25 (unchanged)
- Backend test files: 407 → 419 (+12)
- E2E test files: 101 (unchanged)
- Contract tests: 97 (unchanged)
- TypeSpec files: 55 (unchanged)
- Schema files: 37 (unchanged)
- pgEnums: 96 (unchanged)
- Business rules: 51 → 50 (recount)
- Frontend routes: 97 (unchanged)
- Boilerplate aligned with monobase-js-lf (local-first stack removed)
- 12 structural `as any` casts fixed with proper type definitions

## 2. Project Overview

- **Modules discovered:** 25 handler directories
- **Schema files:** 37 across 25 modules
- **API endpoints:** 360 (GET: 141, POST: 134, PATCH: 41, DELETE: 38, PUT: 6)
- **Business rules documented:** 40 (BR-01–BR-40) + 10 handler-extracted (H-01–H-10)
- **Roles identified:** 13 distinct role/position combinations
- **State machines documented:** 10 (3 with formal guards)
- **pgEnums total:** 96 (10 documented + 11 undocumented status enums + others)
- **Tests found:** 617 total (419 unit/integration + 101 E2E + 97 contract)
- **Frontend apps:** 3 (account: 16 routes, admin: 11 routes, memberry: 70 routes)
- **Product docs:** 16 PRD artifacts + 19 module specs

## 3. Project Structure

**Stack:** TypeScript + Bun 1.2.21 + Hono (API) + Drizzle ORM (PostgreSQL) + TanStack Router + Vite

**Monorepo layout:**

| Directory | Purpose | Module? |
|-----------|---------|---------|
| `apps/account/` | Cloud account app (auth, profile, settings) — port 3002 | App |
| `apps/admin/` | Platform ops dashboard — port 3003 | App |
| `apps/memberry/` | Product app (membership, dues, events, training) — port 3004 | App |
| `services/api-ts/` | Reference TypeScript API (Hono + Drizzle) | Service |
| `specs/api/` | TypeSpec definitions → OpenAPI + TS types | Spec |
| `packages/sdk-ts/` | Auto-generated TanStack Query hooks + client | Package |
| `packages/eslint-config/` | Shared ESLint flat configs | Package |
| `packages/typescript-config/` | Shared TS configs | Package |
| `services/api-ts/src/core/` | Shared infrastructure (auth, config, db, errors, health, jobs, logger, metrics) | Infra |
| `services/api-ts/src/middleware/` | Auth, rate-limit, org-context, request-id middleware | Infra |
| `services/api-ts/src/handlers/` | 25 handler directories (business modules) | Modules |

## 4. Module Map

| Module | Handler Files | TypeSpec? | Primary Entities | Priority |
|--------|--------------|-----------|-----------------|----------|
| association:member | 166 | Yes | membership, chapters, credentials, credits, dues, governance | Core |
| association:operations | 54 | No | committees, committee_tasks, events, training | Core |
| communication | 28 | No | messages, announcements, templates, webhooks | Core |
| person | 27 | Yes | person (PII hub) | Core |
| platformadmin | 21 | Yes | platform_admins, organizations | Core |
| booking | 19 | Yes | booking_events, time_slots, bookings | Feature |
| billing | 16 | Yes | invoices, invoice_items, billing_configs | Core |
| documents | 15 | No | documents, access_logs | Feature |
| membership | 14 | Yes | memberships (shared with assoc:member) | Core |
| training | 13 | No | training_courses, enrollments | Feature |
| email | 11 | Yes | email_queue, templates, suppressions | Infra |
| comms | 11 | Yes | chat_rooms, chat_messages, video_calls | Feature |
| events | 10 | No | events, registrations | Feature |
| marketplace | 9 | No | vendors, listings, orders | Future |
| advertising | 7 | No | advertisers, campaigns, creatives | Future |
| elections | 7 | No | elections, candidates, ballots | Feature |
| jobs | 7 | No | job_postings, job_applications | Future |
| storage | 6 | Yes | files | Infra |
| dues | 6 | Yes | dues_payments, dues_status_history | Core |
| notifs | 6 | Yes | notifications, notification_preferences | Infra |
| certificates | 4 | No | certificates | Feature |
| reviews | 4 | Yes | reviews | Feature |
| invite | 3 | No | invitations | Feature |
| audit | 1 | Yes | audit_logs | Infra |
| accredited-providers | 0 (app.ts) | No | accredited_providers | Feature |

**Module Dependencies (critical):**
- `association:member` ↔ `dues` (bi-directional, P1)
- `association:member` ↔ `person` (bi-directional, P1)
- `association:member` ↔ `membership` (bi-directional, P1)
- `platformadmin` ← 5 modules (pure dependency, clean)

## 5. Domain Glossary Summary

**Source:** `docs/product/DOMAIN_GLOSSARY.md` (346 lines, 70 terms, 16 sections)

- **Terminology conflicts:** 0 (glossary is clean)
- **Key sections:** Core Entities, Officer Sub-Roles, Membership Terms, Financial Terms, Activity Terms, Credit Terms, Identity/Credential Terms, Communications Disambiguation, Training/Course Disambiguation, Field Naming, Platform Terms, Acronyms, Localization, DDD Classification, Bounded Contexts, ACL Recommendations

### DDD Analysis

| Bounded Context | Aggregate Root | Entities | Domain Events | Cross-Module Pattern |
|----------------|---------------|----------|---------------|---------------------|
| Identity | Person | person, privacy_settings | PersonCreated, PersonDeactivated | API (referenced by all) |
| Membership | Membership | memberships, status_history | MembershipStatusChanged | Direct import (tight) |
| Financial | DuesPayment | dues_payments, invoices, fund_allocations | PaymentReceived, InvoiceFinalized | Direct import (tight) |
| Activities | Event/BookingEvent | events, bookings, registrations, time_slots | EventCreated, RegistrationConfirmed | Direct import |
| Communication | Announcement | messages, announcements, templates, webhooks | MessageSent, AnnouncementPublished | Direct import |
| Content | Document | documents, certificates, access_logs | CertificateGenerated | API |
| Governance | Election | elections, candidates, ballots | ElectionOpened, VoteCast | API |
| Platform | Organization | organizations, platform_admins | OrgStatusChanged | Direct import |
| Advertising | Advertiser | advertisers, campaigns, creatives | — | Isolated |
| Marketplace | Vendor | vendors, listings, orders | — | Isolated |
| Jobs | JobPosting | job_postings, job_applications | — | Isolated |

**Anti-corruption layers found:** 0 formal ACLs. DOMAIN_MODEL.md recommends ID-based references but code uses direct imports.
**Anti-corruption layers missing:** All 6 documented cross-context imports lack translation layers.
**Missing domain event infrastructure:** No event emission system exists — grep for `emit`, `dispatch`, `publish.*event`, `EventEmitter` found zero domain event dispatches. Cross-module effects handled via direct function calls.

## 6. Permission Summary

### Roles Found

| Role | Source | Description |
|------|--------|-------------|
| `admin` | auth.ts, config.adminEmails | System admin, full access |
| `user` | auth.ts default | Default authenticated user |
| `platform_admin` | platform-admin-auth.ts, DB table | Verified against platform_admin table |
| `coordinator` | TypeSpec routes | Association management |
| `member` | org-context.ts | Org-scoped member |
| `member:owner` | TypeSpec routes | Owner-permission syntax |
| `association:admin` | TypeSpec routes | Association-level admin |
| `chapter:officer` | TypeSpec routes | Chapter officer |
| `support` | booking/authorization.ts | Support staff |
| `client` / `host` | booking context | Booking context roles |
| Officer positions | officer-auth.ts | President, Treasurer, Secretary (require 2FA in prod) |

### Unprotected Routes (intentional)

| Route | Method | Module | Risk |
|-------|--------|--------|------|
| `/email/unsubscribe` | GET, POST | email | Low — RFC 8058 compliant |
| `/association/member/credentials/public-verify` | POST | association | Low — public by design |
| `/association/member/ethics/public-complaints` | GET, POST | association | Medium — public submission |
| `/association/member/directory/search` | GET | association | Low — public directory |
| `/public/org/:slug` | GET | association | Low — public org info |
| `/livez`, `/readyz`, `/metrics`, `/docs` | GET | infra | None — infrastructure |
| `/accredited-providers/:orgId` | ALL | training | **Medium — auth but no role check (P2)** |

## 7. Business Rules Summary

**40 explicit rules** documented in `docs/ver-3/business/business-rules.md` (BR-01 through BR-40) with companion `br-registry.json`.

**10 handler-extracted rules** (H-01 through H-10) not in BR doc:

| Rule ID | Rule | Type | Confidence |
|---------|------|------|------------|
| H-01 | Only invoice merchant or admin can finalize invoices | Explicit BR | High |
| H-02 | Invoice must be in draft status to finalize | Explicit BR | High |
| H-03 | Invoice must have positive total to finalize | Explicit BR | High |
| H-04 | Users can only view/pay their own invoices | Explicit BR | High |
| H-05 | Booking status transitions follow defined state machine | Explicit BR | High |
| H-06 | Dues recording restricted to TREASURER or PRESIDENT | Explicit BR | High |
| H-07 | 5-min concurrent payment guard (M6-R4) | Explicit BR | High |
| H-08 | Only draft elections can open nominations | Explicit BR | High |
| H-09 | Active membership required to cast ballot (BR-34) | Explicit BR | High |
| H-10 | Account deletion can be cancelled before execution, not after (410 Gone) | Explicit BR | High |

## 8. API Surface Summary

**Total endpoints: 360** (from OpenAPI spec)

| Metric | Count |
|--------|-------|
| GET endpoints | 141 |
| POST endpoints | 134 |
| PATCH endpoints | 41 |
| DELETE endpoints | 38 |
| PUT endpoints | 6 |
| TypeSpec coverage | 15/25 modules (60%) |
| Hand-wired routes | 7 (in app.ts) |
| Dark modules (no OpenAPI) | 3 (advertising, marketplace, jobs) |

**Hand-wired routes (not in OpenAPI):**
- `GET/POST /email/unsubscribe` — public unsubscribe
- `GET /email/suppressions` — suppression list
- `GET/POST/PATCH/DELETE /accredited-providers/:organizationId` — provider CRUD

**TypeSpec-only (no handler code):** `patient.tsp`, `provider.tsp` — spec exists, no implementation.

### 8b. API Contract Drift

No per-module `API_CONTRACTS.md` files exist. Operating in pure extraction mode.

## 9. State Machines Summary

### Documented State Machines (10)

| Entity | Status Enum | Values | Guards? | Gap |
|--------|------------|--------|---------|-----|
| Membership | `membership_status` | active, lapsed, grace, suspended, expired, resigned, deceased, honorary | **YES** — `VALID_TRANSITIONS` | None |
| Election | `election_status` | draft, nominations_open, voting_open, closed, cancelled | **YES** — `VALID_TRANSITIONS` | None |
| Organization | `org_status` | active, suspended, dissolved | **YES** — `VALID_TRANSITIONS` | None |
| Dues Payment | `dues_payment_status` | pending, processing, succeeded, failed, refunded, partially_refunded, disputed, expired, waived | **NO** — comment only | P1 |
| Dues Invoice | `dues_invoice_status` | generated, sent, partially_paid, paid, overdue, cancelled, waived, written_off | **NO** | P1 |
| Booking | `booking_status` | pending, confirmed, cancelled, completed, no_show | **PARTIAL** — comment declares transitions | P2 |
| Training Enrollment | `enrollment_status` | enrolled, completed, failed, withdrawn, no_show | **NO** | P2 |
| Communication Message | `delivery_status` | queued, sending, delivered, failed, bounced | **NO** | P2 |
| Email Queue | `email_queue_status` | queued, sending, sent, delivered, bounced, failed, cancelled | **NO** | P2 |
| Billing Invoice | `invoice_status` | draft, open, paid, void, uncollectible | **NO** | P2 |

**Summary:** 3/10 have formal guards. 7 lack enforcing code.

### Undocumented Status Enums (11)

| Enum | Values | Module |
|------|--------|--------|
| campaign_status | draft, pending_review, active, paused, completed, rejected | advertising |
| creative_status | pending, approved, rejected | advertising |
| transfer_status | requested, pendingSourceApproval, pendingTargetApproval, approved, denied, completed, cancelled | association:member |
| license_status | active, expired, suspended, revoked, pending | association:member |
| credential_status | active, suspended, revoked, expired | association:member |
| committee_status | active, disbanded, on_hold | association:operations |
| committee_task_status | todo, in_progress, done, blocked | association:operations |
| job_posting_status | draft, active, closed, filled | jobs |
| job_application_status | applied, screening, interviewed, offered, hired, rejected, withdrawn | jobs |
| listing_status | draft, active, sold_out, discontinued | marketplace |
| announcement_status | draft, published, archived | communication |

### 9b. Domain Model Drift

| Category | Count | Severity |
|----------|-------|----------|
| Undocumented schema tables | 3 (billing_configs, email_suppressions, notification_preferences) | P2 |
| Spec-only entities (no schema) | 2 (patient, provider) | P2 |
| Missing domain event infrastructure | ALL (0 emitters exist) | P1 |
| Documented cross-context coupling | 6 direct import pairs | P2 |
| Undocumented status enums | 11 | P2 |
| Duplicate enum name risk | 1 (`template_status` in communication + email) | P2 |

## 10. UI / Screens Summary

| App | Routes | Components | Mock Data? | Prototype Contamination? |
|-----|--------|------------|------------|--------------------------|
| account | 16 | 56 | Placeholders only | No |
| admin | 11 | 13 | Placeholders only | No |
| memberry | 70 | 185 | Placeholders + test mocks | No |
| **Total** | **97** | **254** | | |

**No mock/prototype contamination found.** All "mock" hits are form `placeholder=` attributes or `vi.mock()` in test files. No `lorem`, `dummy`, or `fake` data in production code.

### Key Screens by App

- **account (16):** Dashboard, bookings (list/detail/host), notifications, settings (account/billing/schedule/security), auth, onboarding, verify-email
- **admin (11):** Dashboard, associations (list/detail), audit log, feature flags, impersonation, members, operators, organizations (list/detail)
- **memberry (70):** My (profile/settings/payments/certificates/credits/events/training/id-card/notifications/data-export), Org (home/members/dues/events/elections/training), Officer (applications/communications/dues/events/members/settings×7/training), Public (auth/onboarding/invite/org/pay/verify)

## 11. Test Coverage Summary

| Category | Total Items | Tested | Coverage | Assertion Quality |
|----------|------------|--------|----------|-------------------|
| Handler modules | 25 | 25 | 100% | 91%+ strong |
| Backend test files | — | 419 | — | — |
| E2E test specs | — | 101 | — | — |
| Contract tests (.hurl) | — | 97 | — | — |
| Middleware tests | — | 5 | — | — |

### Test Type Classification (top modules)

| Module | Unit/Integ | E2E | Contract | Total | Handlers |
|--------|-----------|-----|----------|-------|----------|
| association:member | 44 | ~30 | ~25 | ~99 | 166 |
| communication | 35 | ~3 | ~3 | ~41 | 28 |
| person | 32 | ~2 | ~3 | ~37 | 27 |
| platformadmin | 24 | ~6 | 1 | ~31 | 21 |
| booking | 24 | 0 | ~6 | ~30 | 19 |
| billing | 21 | 0 | ~3 | ~24 | 16 |
| membership | 23 | ~5 | ~2 | ~30 | 14 |
| training | 18 | ~8 | ~4 | ~30 | 13 |
| email | 17 | 0 | ~2 | ~19 | 11 |
| events | 16 | ~4 | ~3 | ~23 | 10 |

### Assertion Quality (top 5)

| Module | Strong | Weak | Ratio | Grade |
|--------|--------|------|-------|-------|
| communication | 429 | 5 | 98.8% | A+ |
| association:operations | 476 | 20 | 96.0% | A |
| association:member | 1005 | 62 | 94.2% | A |
| booking | 310 | 31 | 90.9% | A |
| person | 294 | 87 | 77.2% | B |

**Underserved modules:** storage (2 tests / 6 handlers), marketplace (3 / 9), comms (5 / 11).

## 12. Security Audit (OWASP Top 10)

| OWASP Category | Status | Severity | Notes |
|----------------|--------|----------|-------|
| A01: Broken Access Control | 4 items | P2 | accredited-providers no role check; fail-open orgContext on 7 prefixes; inconsistent dues auth; no CSRF tokens |
| A02: Cryptographic Failures | OK | — | HMAC-SHA256 sessions, Argon2/bcrypt passwords, secret rotation |
| A03: Injection | OK | — | Zero raw SQL concatenation, all Drizzle parameterized, no shell exec |
| A04: Insecure Design | 1 item | P3 | 2FA skipped in dev mode |
| A05: Security Misconfiguration | OK | — | CORS config-driven, secureHeaders() (CSP, HSTS, X-Frame-Options) |
| A06: Vulnerable Components | Not audited | — | Requires `bun audit` |
| A07: Auth Failures | OK | — | Account lockout, rate limiting, session limits, timing-safe tokens |
| A08: Software Integrity | OK | — | No dangerouslySetInnerHTML |
| A09: Logging Failures | 3 items | P3 | Seed scripts log creds (dev-only), admin emails logged at startup, debug mode exposes internal fields |
| A10: SSRF | OK | — | No user-controlled URLs in server-side fetch |

**Summary:** P0: 0 | P1: 0 | P2: 4 | P3: 4

## 13. Observability Audit

| Area | Status | Severity | Notes |
|------|--------|----------|-------|
| Structured logging | PASS | — | Pino with JSON serialization, PII masking (`maskEmail`), service label |
| Request ID / Correlation | PASS | — | UUID per request via `X-Request-ID`, propagated in context + error responses |
| Metrics | PARTIAL | P3 | In-memory Prometheus `/metrics` — request count, error count, uptime. **Missing: latency histograms (p50/p95/p99)** |
| Health checks | PASS | — | `/livez` (liveness) + `/readyz` (readiness: DB + storage + jobs). RFC `application/health+json` |
| Distributed tracing | MISSING | P2 | No OpenTelemetry, no trace/span IDs |
| Per-request log correlation | PARTIAL | P3 | requestId in error middleware but not bound to Pino child logger per request |
| Alerting | MISSING | P3 | No alert rules or threshold monitoring configured |

## 14. Performance Audit

| Pattern | Instances | Severity | Key Files |
|---------|-----------|----------|-----------|
| N+1 queries (loop + await db) | 3 confirmed | P2 | communication/bulkUpdatePersonSubscriptions.ts, communication/createMessage.ts, certificates/batchGenerateCertificates.ts |
| N+1 queries (likely) | 1 | P3 | dues/bulkRecordPayments.ts (loop + getNextReceiptSequence) |
| Unbounded findMany | ~15 | P2 | booking.repo (4), governance.repo (4), marketplace repos (2), comms/chatMessage.repo, certificates.repo, audit.repo, events.repo (2), membership.repo, credits.repo |
| Missing FK indexes | 2 | P3 | dues-payments.schema (idempotencyKey), invite.schema (personId) |

## 15. Inconsistency Report

### Critical (Security/Data Integrity)

| ID | Type | Description | Files | Impact |
|----|------|-------------|-------|--------|
| IC-01 | Access control | `accredited-providers` routes have auth but no role restriction | app.ts:~185 | Any authenticated user can CRUD providers |
| IC-02 | Access control | Fail-open `orgContextOptionalMiddleware` on 7 route prefixes | app.ts, org-context.ts | Org isolation depends entirely on handler-level checks |

### Major (Functional Gaps)

| ID | Type | Description | Files | Impact |
|----|------|-------------|-------|--------|
| IM-01 | State machine | 7/10 documented state machines lack formal transition guards | Various handler repos | Invalid state transitions possible |
| IM-02 | Coupling | 3 bi-directional import cycles involving association:member | handlers/{dues,person,membership} | Circular dependency risk, impedes module split |
| IM-03 | Performance | 15 unbounded findMany queries without LIMIT | Various repo files | Full table scans possible |
| IM-04 | Domain events | Zero domain event emission infrastructure | All handlers | Cross-module effects via tight coupling only |

### Minor (Consistency)

| ID | Type | Description | Files | Impact |
|----|------|-------------|-------|--------|
| Im-01 | Auth pattern | Dues handlers use manual `if (!user)` instead of middleware | bulkRecordPayments.ts, recordManualPayment.ts | Inconsistent with other modules |
| Im-02 | Naming | `template_status` enum defined in both communication and email schemas | communication.schema.ts, email.schema.ts | Potential migration conflict |
| Im-03 | Coverage | 3 orphan handlers (audit, invite, reviews) lack MODULE_SPEC | handlers/{audit,invite,reviews} | No spec-to-code traceability |

### 15b. Stub & TODO Inventory

| Severity | Count | Top Modules |
|----------|-------|-------------|
| P1 (runtime stubs) | 8 | association:member (institutional membership CRUD: 7 handlers + recalculateAgingBucket) |
| P1 (incomplete logic) | 3 | billing (tax calc, platform fee, line items) |
| P2 (schema/util gaps) | 14 | billing (9 schema TODOs), billing/createInvoice, billing/updateInvoice |
| P3 (TODO markers) | 5 | dues/jobs (1), apps (2), packages/sdk-ts (1), apps/account E2E (1 FIXME) |

**Summary:** 11 runtime stubs (P1), 14 incomplete (P2), 5 informational (P3)

Key P1 stubs: `listInstitutionalMemberships`, `getInstitutionalMembership`, `createInstitutionalMembership`, `updateInstitutionalMembership`, `deleteInstitutionalMembership`, `allocateSeat`, `revokeSeat`, `listSeatAllocations` — all institutional membership (not yet implemented).

### 15c. Type Cast Density

| Area | Files w/casts | Total Casts | `as any` | `as unknown` | `@ts-ignore` | Severity |
|------|---------------|-------------|----------|--------------|--------------|----------|
| handlers (prod) | few | 4 | 4 | 0 | 0 | LOW |
| handlers (test) | many | 1,487 | 1,487 | 0 | 0 | MEDIUM |
| generated code | 3 | 596 | 1 | 360 | 137 | N/A |
| middleware | ~5 | 31 | 30 | 1 | 0 | MEDIUM |
| apps (hand-written) | many | 142 | 142 | 36 | 22 | MEDIUM |
| seed-scenarios.ts | 1 | 88 | 88 | 0 | 0 | HIGH |
| packages | few | 7 | 7 | 5 | 0 | LOW |

**Production handler code: 4 `as any` casts total — excellent type safety.**
Test files: 1,487 casts (mock context typing boilerplate — common pattern, not a defect).
Top offender (non-generated, non-test): `seed-scenarios.ts` (88 casts — schema drift in seed data).

**Internal vs external ratio:** 75% internal / 25% external (generated). Of internal: 85% in test files.

### 15d. Cross-Module Import Violations

| Source Module | Imports From | Import Count | Bi-directional? |
|--------------|-------------|--------------|----------------|
| person | association:member, platformadmin | 12 | YES (with assoc:member) |
| dues | association:member, association:operations, platformadmin | 4 | YES (with assoc:member) |
| membership | association:member, platformadmin, person | 5 | YES (with assoc:member) |
| association:member | platformadmin, dues, person, membership | 8 | YES (3 pairs) |
| association:operations | notifs | 1 | No |
| invite | platformadmin | 1 | No |
| events | membership | 1 | No |

**Total: ~35 cross-module imports across 9 modules**
**Bi-directional coupling pairs (P1):** `association:member ↔ dues`, `association:member ↔ person`, `association:member ↔ membership`
**Coupling hub:** `association:member` (participates in all 3 cycles, imported by 6+ modules)

### 15e. Cross-Module Raw SQL

| File:Line | SQL Fragment | Table's Module | Current Module | Severity |
|-----------|-------------|---------------|---------------|----------|
| dues/getDuesDashboard.ts:6 | imports events schema | association:operations | dues | P2 |
| dues/jobs/reminderProcessor.ts:102 | `memberships.duesExpiryDate::date` | association:member | dues | P2 |

**Type casts in raw SQL:** ~8 instances (all `::date` casts). All use Drizzle parameterized templates — no injection risk.
**String interpolation:** None found. All SQL safe.
**Summary:** 2 cross-module raw SQL refs (P2), 8 type casts (P3), 0 injection risks (P0)

### 15f. Security Audit (OWASP)

See Section 12 above. **P0: 0 | P1: 0 | P2: 4 | P3: 4**

### 15g. Observability Audit

See Section 13 above. Structured logging PASS, request IDs PASS, health checks PASS. Missing: distributed tracing (P2), latency histograms (P3).

### 15h. Performance Anti-Patterns

See Section 14 above. 3 N+1 (P2), 15 unbounded queries (P2), 2 missing indexes (P3).

## 16. Repository Guardrails Review

| File | Exists? | Lines | Accurate? | Gaps |
|------|---------|-------|-----------|------|
| ARCHITECTURE.md | YES | 343 | Yes — covers purpose, tech stack, module structure | None |
| CONTRIBUTING.md | YES | 2434 | Yes — comprehensive dev setup, workflows, conventions | None |
| CLAUDE.md | YES | 419 | Yes — accurate module map, handler counts, key patterns | Consent mgmt noted as planned (correct) |
| README.md | YES | 344 | Yes — project overview, commands, tech stack | None |
| VERTICAL_TDD.md | YES | 308 | Yes — vertical TDD protocol, per-module gates | None |

**All 5 guardrail files present and accurate (3,848 total lines).** No stale or misleading content detected.

## 17. PRD / Spec Coverage Review

| Artifact | Exists? | Lines | Quality | Notes |
|----------|---------|-------|---------|-------|
| MASTER_PRD.md | YES | 527 | Good | Full PRD with 19 modules |
| DOMAIN_GLOSSARY.md | YES | 346 | Good | 70 terms, 0 conflicts |
| ROLE_PERMISSION_MATRIX.md | YES | 333 | Good | Complete |
| MODULE_MAP.md | YES | 161 | Adequate | |
| DOMAIN_MODEL.md | YES | 1575 | Strong | 11 BCs, 18 events, 4 state machines |
| STATE_MACHINES.md | YES | 283 | Adequate | 10 machines documented |
| WORKFLOW_MAP.md | YES | 699 | Good | |
| EVENT_CONTRACTS.md | YES | 625 | Good | |
| TRACE_MATRIX.md | YES | 299 | Adequate | |
| UI_BLUEPRINT.md | YES | 487 | Good | |
| OBSERVABILITY.md | YES | 192 | Thin | Needs expansion |
| DISASTER_RECOVERY.md | YES | 187 | Thin | Needs tested procedures |
| THREAT_MODEL.md | YES | 96 | Skeletal | Lacks STRIDE enumeration, attack trees |
| PERFORMANCE.md | YES | 85 | Skeletal | Targets only, no load profiles |
| DATA_GOVERNANCE_DRAFT.md | YES | 96 | Draft | Defers to domain model |
| SEED_MANIFEST.md | YES | — | Good | |
| Module specs (19/19) | YES | — | Good | All product modules specced |
| VERTICAL_SLICE_PLAN.md | YES | 609 | Good | |

**16/16 PRD artifacts exist.** 4 skeletal (THREAT_MODEL, PERFORMANCE, OBSERVABILITY, DR).

### Module Spec ↔ Code Alignment

- **16/19 specs** have corresponding handler code — aligned
- **3/19 specs** have no code yet: m13-professional-feed, m18-surveys-polls, m19-committee-management
- **3 orphan handlers** lack specs: audit, invite, reviews

## 18. Standards Gap Matrix

| Area | Current State | Target Standard | Gap | Priority |
|------|--------------|-----------------|-----|----------|
| State machine guards | 3/10 formal guards | All status enums have VALID_TRANSITIONS | 7 unguarded + 11 undocumented | P1 |
| Domain event infrastructure | Zero emitters | Event bus for cross-module effects | No event system exists | P1 |
| THREAT_MODEL depth | 96 lines, auto-generated | STRIDE analysis, attack trees, mitigations | Skeletal | P1 |
| DATA_GOVERNANCE | 96 lines, DRAFT | Classification matrix, retention schedules, GDPR/DPA mapping | Draft only | P1 |
| Cross-module coupling | 3 bi-directional cycles | ID-based references, ACLs | No anti-corruption layers | P2 |
| Unbounded queries | 15 instances | All list queries have LIMIT/pagination | Missing LIMIT in repo methods | P2 |
| Distributed tracing | None | OpenTelemetry spans | No trace/span IDs | P2 |
| CSRF protection | SameSite + CORS only | Defense-in-depth CSRF tokens | No explicit CSRF tokens | P2 |
| OBSERVABILITY depth | 192 lines | Runbooks, SLI/SLO definitions | Stub needs expansion | P2 |
| DISASTER_RECOVERY | 187 lines | Tested recovery playbooks | Untested procedures | P2 |
| N+1 queries | 3 confirmed | Batch operations | Loop + await in bulk handlers | P2 |
| Orphan handler specs | 3 handlers lack specs | 100% handler-to-spec coverage | audit, invite, reviews | P2 |
| TypeSpec coverage | 60% (15/25) | 100% | 10 modules hand-wired | P3 |
| Dark modules | 3 (advertising, marketplace, jobs) | All modules in OpenAPI | No SDK visibility | P3 |
| PERFORMANCE depth | 85 lines | Load profiles, benchmark suite | Targets only | P3 |
| Aggregate invariants | Not documented | Explicit invariants per aggregate | Missing from DOMAIN_MODEL | P3 |
| Value object catalog | Not enumerated | Explicit VO catalog | Missing from DOMAIN_MODEL | P3 |

## 19. Risk Assessment

### P0 Risks (Fix Immediately)
None. Previous P0 items resolved.

### P1 Risks (Fix Before Major New Work)
1. **State machine guards** — 7/10 documented machines + 11 undocumented enums lack `VALID_TRANSITIONS`. Invalid transitions possible via API.
2. **Domain event infrastructure** — Zero event emitters. All cross-module effects via direct imports. Blocks event-driven architecture.
3. **THREAT_MODEL** — 96-line skeleton insufficient for regulated healthcare platform. Needs STRIDE enumeration.
4. **DATA_GOVERNANCE** — Draft only. Needs PII classification matrix, retention schedules for DPA 2012/BIR compliance.
5. **Institutional membership stubs** — 8 runtime stubs that will crash if invoked (P1 for any module that references them).

### P2 Risks (Fix When Touching Module)
1. Cross-module coupling (3 bi-directional cycles)
2. 15 unbounded queries
3. 3 N+1 patterns in bulk operations
4. No distributed tracing
5. No CSRF tokens (mitigated by SameSite + CORS)
6. accredited-providers lacks role-based access
7. fail-open orgContextOptionalMiddleware
8. Inconsistent dues auth pattern
9. 3 orphan handlers lack specs
10. Billing schema TODOs (14 items)

### P3 Risks (Improve Later)
1. TypeSpec coverage 60%
2. 3 dark modules
3. Latency histograms missing
4. Missing FK indexes (2)
5. seed-scenarios.ts type cast density (88 `as any`)

## 20. Stabilization Plan

### Fix Immediately (P0)
None outstanding.

### Fix Before Major New Work (P1)
1. Add `VALID_TRANSITIONS` maps to `dues_payment_status` and `dues_invoice_status` (highest transaction volume)
2. Expand THREAT_MODEL.md with STRIDE analysis (at minimum: auth bypass, privilege escalation, data exfiltration, injection vectors)
3. Expand DATA_GOVERNANCE_DRAFT.md to full DATA_GOVERNANCE.md (PII classification matrix, retention schedules, deletion workflows)
4. Document 11 undocumented status enums in STATE_MACHINES.md
5. Gate institutional membership endpoints behind feature flag or remove from routes until implemented

### Fix Before New Work in Module (P2)
1. Add LIMIT to all unbounded `findMany` queries (prioritize: booking, governance, marketplace repos)
2. Fix N+1 in communication/bulkUpdatePersonSubscriptions.ts and certificates/batchGenerateCertificates.ts
3. Add role restriction to accredited-providers routes
4. Create MODULE_SPEC for audit, invite, reviews handlers
5. Resolve billing schema TODOs

### Fix When Convenient (P3)
1. Expand TypeSpec coverage to remaining 10 modules
2. Add OpenAPI endpoints for dark modules (advertising, marketplace, jobs)
3. Add latency histograms to metrics endpoint
4. Add FK indexes to dues-payments.idempotencyKey and invite.personId
5. Clean up seed-scenarios.ts type casts

## 21. Standards Adoption Plan

### Phase 1: Add Guardrails ✅ COMPLETE
- ARCHITECTURE.md ✅
- CONTRIBUTING.md ✅
- CLAUDE.md ✅
- VERTICAL_TDD.md ✅
- README.md ✅
- All 5 guardrail files present and accurate

### Phase 2: Document Current Reality ✅ COMPLETE
- MODULE_MAP.md ✅
- DOMAIN_GLOSSARY.md ✅ (70 terms, 0 conflicts)
- ROLE_PERMISSION_MATRIX.md ✅
- DOMAIN_MODEL.md ✅ (1575 lines, 11 BCs)
- 19/19 Module specs ✅
- STATE_MACHINES.md ✅
- WORKFLOW_MAP.md ✅
- EVENT_CONTRACTS.md ✅
- UI_BLUEPRINT.md ✅
- TRACE_MATRIX.md ✅

### Phase 3: Stabilize Risky Areas — IN PROGRESS
- ✅ Auth middleware (4-layer stack, IDOR prevention)
- ✅ Rate limiting on all endpoints
- ✅ Account lockout
- ✅ Session hardening
- ⬜ State machine guards (7/10 unguarded)
- ⬜ Unbounded query limits (15 instances)
- ⬜ N+1 fixes (3 instances)
- ⬜ THREAT_MODEL expansion
- ⬜ DATA_GOVERNANCE completion

### Phase 4: Adopt Vertical Slice TDD Going Forward ✅ ACTIVE
- VERTICAL_SLICE_PLAN.md ✅
- VERTICAL_TDD.md protocol ✅
- Active execution through phases

### Phase 5: Migrate Existing Code Gradually — ONGOING
- High-risk modules prioritized (dues, billing)
- Mega-module split plan exists (`.planning/phases/14-mega-module-split/SPLIT-PLAN.md`)

## 22. Recommended First 3 Vertical Slices

| Rank | Slice | Module | Why This Slice | Risk | Expected Work |
|------|-------|--------|---------------|------|---------------|
| 1 | State machine guard formalization | dues, billing, booking | Highest transaction volume modules lack transition guards. Invalid state transitions = data corruption. | Medium | Add `VALID_TRANSITIONS` maps + guard functions to 7 modules |
| 2 | Unbounded query pagination | booking, governance, marketplace | 15 `findMany` calls without LIMIT. Full table scan risk grows with data. | Low | Add limit/offset to repo methods, update handler callers |
| 3 | Cross-module ACL extraction | person→association:member | Person module has 12 cross-module imports. Extract to ID-based lookups via service interface. | Medium | Create person-facing service boundary, replace direct repo imports |

## 23. DDD Concepts

### Bounded Contexts (11)
Identity, Membership, Financial, Activities, Communication, Content, Governance, Platform, Advertising, Marketplace, Jobs

### Cross-Module Communication Patterns
- **Direct import (tight coupling):** 35 instances across 9 modules
- **API call (loose coupling):** 0 internal API calls
- **Event/message (async decoupling):** 0 (no event bus)
- **Shared DB table (hidden coupling):** 2 raw SQL cross-module refs

### Missing Infrastructure
- **Event bus/domain events:** Declared in DOMAIN_MODEL.md (18 events) but zero emission infrastructure exists
- **Anti-corruption layers:** Recommended in glossary but none implemented
- **Saga/choreography:** No distributed transaction patterns

## 24. Health Score (19 Dimensions)

| Dimension | Score (0-10) | Notes |
|-----------|-------------|-------|
| Terminology consistency | 9 | 70 terms, 0 conflicts, clean glossary |
| Permission coverage | 8 | 4-layer RBAC, 4 P2 gaps (accredited-providers, orgContext, dues auth, CSRF) |
| Business rule clarity | 9 | 40 BRs + 10 handler-extracted, br-registry.json |
| API consistency | 7 | 60% TypeSpec, 7 hand-wired, 3 dark modules |
| State machine safety | 5 | 3/10 formal guards, 11 undocumented enums |
| Error handling uniformity | 8 | Centralized errors.ts, applySecurity(), consistent patterns |
| Backend test coverage | 9 | 419 files, 100% module coverage, 91%+ strong assertions |
| Frontend test coverage | 7 | 101 E2E (92 memberry, thin account/admin) |
| PRD/spec coverage | 9 | 16/16 artifacts, 19 module specs, 4 skeletal |
| UI prototype readiness | 8 | 97 routes, 254 components, no mock contamination |
| Architecture alignment | 8 | All 5 guardrails present and accurate |
| Domain model clarity | 8 | 1575 lines, 11 BCs, 18 events — missing invariants + VOs |
| Security posture (OWASP) | 9 | 0 P0, 0 P1, 4 P2, strong auth infrastructure |
| Observability coverage | 7 | Pino + request IDs + health checks — missing tracing + latency |
| Performance health | 6 | 15 unbounded queries, 3 N+1, 2 missing indexes |
| Stub density | 8 | 11 P1 stubs contained to institutional membership + billing |
| Type cast density | 9 | 4 `as any` in prod code — excellent |
| Cross-module coupling | 5 | 3 P1 bi-directional cycles, 35 imports, association:member hub |
| Raw SQL leakage | 9 | 2 cross-module refs, all parameterized, no injection risk |

**Overall health: 7.8/10** (148/190)

**Delta from Wave 4 (2026-05-20): 8.2 → 7.8**
Score decrease reflects stricter cross-module coupling analysis and deeper performance anti-pattern detection in this re-baseline, not regression in code quality. Boilerplate alignment (local-first stack removal) and 12 `as any` fixes are positive changes.

## 25. Final Recommendations

### Do Now
1. Formalize `VALID_TRANSITIONS` for `dues_payment_status` and `dues_invoice_status` (transaction integrity)
2. Expand THREAT_MODEL.md beyond skeleton (healthcare regulatory requirement)
3. Gate 8 institutional membership stubs behind feature flag

### Do Next
1. Add LIMIT to 15 unbounded `findMany` queries
2. Fix 3 N+1 patterns in bulk operations
3. Complete DATA_GOVERNANCE.md (PII classification, retention schedules)
4. Document 11 undocumented status enums
5. Add role restriction to accredited-providers routes

### Do Later
1. Implement domain event infrastructure (replace direct cross-module imports)
2. Extract anti-corruption layers for person→association:member boundary
3. Mega-module split per `.planning/phases/14-mega-module-split/SPLIT-PLAN.md`
4. Expand TypeSpec to remaining 10 modules
5. Add OpenTelemetry distributed tracing

### Avoid
- Big-bang rewrite of association:member (157 handlers) — split incrementally
- Adding new cross-module direct imports — use ID-based references
- Treating dark modules (advertising, marketplace, jobs) as production-ready
- Assuming DOMAIN_MODEL.md events exist in code — zero emission infrastructure

## Appendix A: Changes Since Wave 4 Audit (2026-05-20 → 2026-05-21)

| Change | Detail |
|--------|--------|
| Boilerplate alignment | Aligned with monobase-js-lf, removed local-first stack |
| Type fixes | 12 structural `as any` casts replaced with proper type definitions |
| Backend test files | 407 → 419 (+12) |
| Audit methodology | Deeper cross-module import analysis (35 violations catalogued vs summary in Wave 4) |
| Audit methodology | Performance anti-patterns now itemized (15 unbounded queries, 3 N+1) |
| Health score | 8.2 → 7.8 (stricter scoring, not code regression) |

## Appendix B: Historical Corrections Preserved

No user annotations found in previous audit. Clean slate.

## Appendix C: Database Table Inventory (89 tables)

Preserved from Wave 4. No schema changes since 2026-05-20.
