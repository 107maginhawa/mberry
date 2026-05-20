# Existing Codebase Adoption Audit

---
**Audit Date:** 2026-05-20 (Wave 4 deep refresh)
**Source Directory:** /Users/elad-mini/Desktop/memberry
**Stack:** TypeScript + Hono + Drizzle ORM + React 19 + TanStack Router
**Previous Audit:** 2026-05-19 post-Wave 3 (archived as EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-19.md)
**oli version:** v1.2
---

## 1. Executive Summary

**Overall Health: 8.2/10** (156/190 across 19 dimensions)

**Top 3 Strengths:**
1. **Comprehensive test coverage** -- 407 backend test files with 91% strong assertions, 101 E2E tests, 97 Hurl contract tests, 54 component tests across 25 handler modules
2. **Strong auth/RBAC** -- 4-layer auth stack (global middleware + officer position checks + 2FA for privileged roles + platform admin isolation); 31 distinct role combinations across 360 routes; zero unguarded mutations
3. **Full OLI spec coverage** -- 19/19 module specs, DOMAIN_MODEL.md, DOMAIN_GLOSSARY.md, ROLE_PERMISSION_MATRIX.md, UI_BLUEPRINT.md, TRACE_MATRIX.md, SEED_MANIFEST.md, WORKFLOW_MAP.md all present

**Top 3 Gaps:**
1. **State machine guard gaps** -- `dues_payment` (10 states) and `booking` (7 states) lack centralized VALID_TRANSITIONS maps; handler-level guards exist but not formalized. 3 new module enums (advertising, marketplace, jobs) have zero guards
2. **Cross-module coupling** -- 3 bidirectional import pairs (`association:member` <-> `dues`, `person`, `membership`); `association:member` imported by 6+ modules; no anti-corruption layers; no event bus
3. **3 dark modules** -- advertising, marketplace, jobs have handlers + schemas but no OpenAPI/TypeSpec endpoints; invisible to SDK consumers

**Delta Since Last Audit (2026-05-19 Wave 3):**
- Handler modules: 22 -> 25 (+advertising, marketplace, jobs)
- Backend test files: 336 -> 407 (+71)
- E2E test files: 132 -> 101 (recount with stricter criteria)
- Component test files: 44 -> 54 (+10)
- TypeSpec files: 37 -> 55 (+18)
- Schema files: 32 -> 37 (+5)
- pgEnums: 65 -> 96 (+31)
- pgTables: 80+ -> 89 (+9 confirmed)
- Business rules: 40 -> 51 (+11 newly discovered)
- Frontend routes: 93 -> 97 (memberry 66->70)
- Health dimensions: 15 -> 19 (+stub density, type cast density, cross-module coupling, raw SQL leakage)
- Health score: 8.7/10 (131/150) -> 8.2/10 (156/190, more rigorous with 4 new dimensions)

**Recommended Next Action:** Add VALID_TRANSITIONS maps to dues_payment and booking state machines (P1). Then expose advertising/marketplace/jobs via TypeSpec (P1).

---

## 2. Project Overview

| Metric | Count | Delta (Wave 3) |
|--------|-------|----------------|
| Handler modules | 25 (24 + __tests__) | +3 |
| Handler files (non-test) | 588 | +35 |
| Backend test files | 407 | +71 |
| E2E test files | 101 (memberry: 92, admin: 6, account: 3) | recount |
| Component test files | 54 (memberry only) | +10 |
| Interaction state test files | 10 | -- |
| A11y baseline tests | 18 (axe-core across E2E) | +8 |
| Hurl contract tests | 97 | -- |
| OpenAPI endpoints | 360 | -- |
| TypeSpec files | 55 (.tsp files) | +18 |
| Schema files | 37 | +5 |
| Database tables (pgTable) | 89 | +9 |
| Database enums (pgEnum) | 96 | +31 |
| Frontend routes | 97 (memberry: 70, admin: 11, account: 16) | +4 |
| Business rules documented | 51 (BR-01 through BR-51) | +11 |
| Frontend apps | 3 (memberry, admin, account) | -- |
| Backend services | 3 (api-ts, api-ts-embedded, cadence) | -- |
| Shared packages | 4 (ui, sdk-ts, eslint-config, typescript-config) | -- |
| Module specs | 19/19 | NEW |
| Background job modules | 6 (dues, booking, person, notifs, audit, email) | -- |
| WebSocket handlers | 1 (chatRoom) | -- |
| Skipped/todo tests | 21 test.todo + 8 conditional skips | updated |
| BR-specific test files | 11 | NEW |

**Tech Stack:**
- **Runtime:** Bun 1.2.21
- **Backend:** Hono 4.0 + Drizzle ORM 0.44 + PostgreSQL
- **Frontend:** React 19 + Vite 7.1 + TanStack Router/Query
- **Auth:** Better-Auth 1.3.27 (JWT sessions, 2FA, impersonation, passkeys)
- **API Spec:** TypeSpec 1.3 -> OpenAPI 3.0
- **Testing:** Bun test + Vitest + Playwright 1.58.2 + Hurl
- **Jobs:** pg-boss 10.3 (PostgreSQL-backed)
- **Payments:** Stripe 19.1
- **Logging:** Pino 9.0
- **Validation:** Zod 4.1
- **WebSocket:** Hono WSS (comms chat room)

---

## 3. Project Structure

```
memberry/
+-- apps/
|   +-- memberry/          # Product app (70 routes, port 3004)
|   +-- admin/             # Ops dashboard (11 routes, port 3003)
|   +-- account/           # Auth/profile/settings (16 routes, port 3002)
|       +-- src-tauri/     # Desktop wrapper (Rust + QuickJS)
+-- services/
|   +-- api-ts/            # Reference API (25 handler modules, 588 files)
|   +-- api-ts-embedded/   # QuickJS bundle for offline Tauri
|   +-- cadence/           # P2P sync engine (Rust + Iroh)
+-- specs/api/             # TypeSpec definitions + OpenAPI output
|   +-- src/               # 55 .tsp files
|   +-- tests/contract/    # 97 Hurl contract tests
+-- packages/
|   +-- ui/                # Shared Radix UI + Tailwind components
|   +-- sdk-ts/            # Generated TanStack Query hooks
|   +-- eslint-config/     # Shared ESLint flat configs
|   +-- typescript-config/ # Shared TS configs
+-- docs/                  # Architecture, PRD, glossary, audits
|   +-- product/           # 19 module specs, domain model, glossary, blueprints
|   +-- audits/            # 10 audit reports
+-- .planning/             # GSD workflow artifacts
+-- .claude/skills/        # 20 Claude Code skills
```

---

## 4. Module Map

### Handler Modules (25 directories)

| Module | Handler Files | Test Files | Assertions | TypeSpec? | Schema Files |
|--------|-------------|-----------|------------|-----------|-------------|
| association:member | 193 | 44 | 774+ | Yes | 9 |
| association:operations | 63 | 13 | 246+ | Yes | 2 |
| person | 33 | 32 | 231+ | Yes | 3 |
| communication | 30 | 35 | 239+ | Yes | 1 |
| booking | 31 | 24 | 235+ | Yes | 1 |
| platformadmin | 24 | 24 | 199+ | Yes | 1 |
| email | 21 | 17 | 278+ | Yes | 2 |
| billing | 18 | 21 | 293+ | Yes | 1 |
| documents | 17 | 18 | 188+ | Yes | 1 |
| dues | 17 | 16 | 168+ | Yes | 2 |
| training | 16 | 18 | 217+ | No (hand-wired) | 1 |
| membership | 17 | 23 | 294+ | Yes | 0 |
| comms | 14 | 5 | 131+ | Yes | 1 |
| marketplace | 13 | 3 | -- | **No (dark)** | 1 |
| events | 12 | 16 | 205+ | No (hand-wired) | 0 |
| advertising | 11 | 7 | -- | **No (dark)** | 1 |
| elections | 9 | 15 | 134+ | No (hand-wired) | 1 |
| notifs | 9 | 7 | 77+ | Yes | 1 |
| jobs | 9 | 7 | -- | **No (dark)** | 1 |
| storage | 8 | 2 | 77+ | Yes | 1 |
| certificates | 7 | 7 | 27+ | No (hand-wired) | 1 |
| invite | 6 | 4 | 71+ | No (hand-wired) | 1 |
| reviews | 6 | 5 | 76+ | Yes | 0 |
| audit | 4 | 4 | 112+ | Yes | 1 |
| __tests__ (cross-cutting) | 0 | 9 (integration) | -- | -- | -- |
| **TOTAL** | **588** | **~407** | **~4,500+** | **14/24 (58%)** | **37** |

**TypeSpec Coverage:** 14/24 modules (58%) have TypeSpec definitions. 3 are dark (advertising, marketplace, jobs -- schema+handlers exist, no OpenAPI). 7 hand-wired (documents, training, events, elections, invite, certificates, comms).

### Dependency Matrix (Cross-Module Imports)

| Importing Module | Imports From | Import Count | Bidirectional? |
|-----------------|-------------|-------------|----------------|
| association:member | dues, person, membership | ~48 combined | **YES** (all 3) |
| person | association:member (membership, credits, governance repos) | ~15 | **YES** |
| dues | association:member (membership-lifecycle utils) | ~25 | **YES** |
| membership | association:member (membership schema) | ~8 | **YES** |
| association:operations | association:member (membership, credits repos) | ~10 | No |
| email | association:member (membership schema) | ~3 | No |
| billing | person (person schema) | ~2 | No |
| communication | association:member (membership schema) | ~3 | No |
| elections | association:member (governance.schema, governance.repo) | ~5 | No |

**Key Finding:** 3 bidirectional import pairs create circular dependency risk. `association:member` is imported by 6+ modules and imports from 3 -- it is both the most-depended-upon AND most-dependent module.

---

## 5. Domain Glossary Summary

### Key Domain Terms

| Term | Definition | Source | Conflicts |
|------|-----------|--------|-----------|
| Person | Central PII entity (name, email, phone) | person.schema.ts | None |
| Membership | Association membership record linking person to org | membership.schema.ts | None |
| Organization | Chapter/branch of an association | platform-admin.schema.ts | `orgId` vs `organizationId` in TypeSpec |
| Association | Parent body grouping organizations | platform-admin.schema.ts | None |
| Officer Term | Time-bounded role assignment for org governance | governance.schema.ts | None |
| Credit Entry | CPD credit record (auto or manual) | credits.schema.ts | None |
| Dues Config | Per-org billing cycle configuration | dues.schema.ts | `dues_config` vs `dues_org_config` table names |
| Credential | Professional license/certification | credentials.schema.ts | None |
| Accredited Provider | PRC-approved training provider | training.schema.ts | None |
| Vendor | Marketplace seller entity | marketplace.schema.ts | NEW |
| Advertiser | Ad campaign owner entity | advertising.schema.ts | NEW |
| Job Posting | Employment listing entity | jobs.schema.ts | NEW |

### Terminology Conflicts (6)

| Concept | Term A | Term B | Location |
|---------|--------|--------|----------|
| Organization ID | `orgId` (42x in TypeSpec) | `organizationId` (47x) | specs/api/src/ |
| Payment status | `dues_payment_status` | `payment_status` | dues vs billing schema |
| Invoice | `dues_invoice` | `invoice` | dues vs billing module |
| Channel | `comm_channel` | `dunning_channel` | communication vs dunning |
| Status naming | `booking_event_status` | `event_status` | booking vs events (different concepts, confusing) |
| Template | `message_template` | `email_template` | communication vs email |

### DDD Classification

| Entity | Classification | Aggregate Root? | Domain Events (Inferred) | Bounded Context |
|--------|---------------|----------------|-------------------------|-----------------|
| Person | Entity | Yes | PersonCreated, PersonUpdated, PersonAnonymized | Identity |
| Membership | Entity | Yes | MembershipApproved, MembershipSuspended, MembershipResigned | Membership |
| Organization | Entity | Yes | OrganizationCreated | Platform Admin |
| Association | Entity | Yes | AssociationCreated | Platform Admin |
| Officer Term | Entity | No -- child of Organization | OfficerTermCreated, OfficerTermExpired | Governance |
| Credit Entry | Entity | No -- child of Membership cycle | CreditAwarded, CreditVerified | Training/CPD |
| Dues Invoice | Entity | Yes | InvoiceGenerated, InvoicePaid, InvoiceCancelled | Billing |
| Dues Payment | Entity | No -- child of Dues Invoice | PaymentConfirmed, PaymentRefunded | Billing |
| Booking | Entity | Yes | BookingConfirmed, BookingCancelled | Scheduling |
| Event | Entity | Yes | EventPublished, EventCancelled, EventCompleted | Events |
| Training | Entity | Yes | TrainingPublished, TrainingCompleted | Training/CPD |
| Election | Entity | Yes | ElectionOpened, ElectionPublished, ElectionCancelled | Governance |
| Chat Room | Entity | Yes | ChatRoomCreated, ChatRoomArchived | Communications |
| Vendor | Entity | Yes | VendorApproved | Marketplace (NEW) |
| Ad Campaign | Entity | Yes | CampaignActivated, CampaignPaused | Advertising (NEW) |
| Job Posting | Entity | Yes | JobPosted, JobClosed | Jobs (NEW) |

### Value Objects (5)

| Value Object | Location | Notes |
|---|---|---|
| BillingCycle | `dues/utils/expiry-extension.ts` | 'annual', 'semi-annual', 'quarterly' |
| ComputedMembershipStatus | `association:member/utils/compute-membership-status.ts` | Pure function, never stored |
| CreditCycle | `association:member/utils/credit-cycle.ts` | cycleStart/cycleEnd derived |
| RefundEligibility | `dues/utils/refund-validation.ts` | eligible/reason/code |
| Notification Preference | JSONB on Person | Immutable settings |

**Bounded Context Candidates (11):**
1. Identity, 2. Membership, 3. Billing, 4. Training/CPD, 5. Governance, 6. Events, 7. Communications, 8. Platform Admin, 9. Marketplace (NEW), 10. Advertising (NEW), 11. Employment (NEW)

**Anti-Corruption Layers Found:** None.
**Anti-Corruption Layers Missing [INFERRED]:** Person <-> Membership, Dues <-> Membership, Email <-> Membership

---

## 6. Permission Summary

### Roles (14 roles across 3 scopes)

| Role | Scope | Source |
|------|-------|--------|
| client | System-wide | types/auth.ts |
| host | System-wide | types/auth.ts |
| admin | System-wide | types/auth.ts |
| user | Any authenticated | types/auth.ts |
| super | Platform admin | types/auth.ts (AdminPrivilegeLevel) |
| support | Platform admin | types/auth.ts |
| president | Org-scoped | utils/org-auth.ts (highest privilege) |
| vice-president | Org-scoped | utils/org-auth.ts |
| secretary | Org-scoped | utils/org-auth.ts |
| treasurer | Org-scoped | utils/org-auth.ts |
| board-member | Org-scoped | utils/org-auth.ts |
| officer | Org-scoped | utils/org-auth.ts |
| staff | Org-scoped | utils/org-auth.ts |
| member | Org-scoped | utils/org-auth.ts (lowest privilege) |

### Auth Middleware Stack (4 layers)

1. **Global auth middleware** (app.ts) -- session validation, banned user rejection
2. **Officer auth middleware** (officer-auth.ts) -- verifies active officer term; 2FA for president/treasurer/secretary
3. **Platform admin middleware** -- checks `platform_admin` table membership
4. **Handler-level guards** -- `requirePosition()`, `requireOrgRole()`, `requireActiveStatus()`, `requireTenantAccess()`

### 2FA Enforcement

Privileged positions requiring 2FA: **president, treasurer, secretary** (defined in `PRIVILEGED_POSITIONS` Set in both `officer-auth.ts` and `officer-check.ts`).

### Public (Unprotected) Routes

| Route | Method | Purpose | Risk |
|-------|--------|---------|------|
| `/email/unsubscribe` | GET/POST | RFC 8058 one-click unsubscribe | Low |
| `/email/suppressions` | GET | **Suppression list -- lacks auth middleware** | **MEDIUM (SEC-01)** |
| `/association/member/credentials/public-verify` | GET | Credential verification | Low |
| `/association/member/ethics/public-complaints` | GET | Public ethics complaints | Low |
| `/association/member/ethics/public-complaint` | POST | Submit ethics complaint (captcha) | Low |
| `/association/member/directory/public` | GET | Public member directory (opt-in) | Low |
| `/association/member/directory/search` | GET | Public directory search (opt-in) | Low |
| `/livez`, `/readyz` | GET | K8s probes | Low |
| `/feature-flags` | GET | Deployment-level flags | Low |

**NEW Finding (SEC-01):** `/email/suppressions` at `app.ts:142` appears to lack `authMiddleware()` wrapper. Could expose email suppression data.

### Permission Guard Inconsistencies

| Issue | Details |
|---|---|
| Mixed auth styles | Some handlers: manual `if (!user)`, others: `throw new UnauthorizedError()`, others: middleware |
| `requirePosition` vs `officerAuthMiddleware` | Two parallel systems: middleware (throws) vs handler-level (returns Response) |
| `orgContextMiddleware` role flattening | Sets `role='member'` for ALL org users -- `requireOrgRole()` can't distinguish members from officers |
| PRIVILEGED_POSITIONS duplication | Same Set defined in both `officer-auth.ts` and `officer-check.ts` (SEC-03) |

---

## 7. Business Rules Summary

**Total: 51 business rules** (BR-01 through BR-51)

### Phase Coverage

| Phase | BR Range | Count | Status |
|-------|----------|-------|--------|
| Phase 1 | BR-01 to BR-32 | 32 | Implemented |
| Phase 2 | BR-33 to BR-37 | 5 | BR-33, BR-34 implemented; BR-35 to BR-37 deferred |
| Phase 3 | BR-38 to BR-40 | 3 | Deferred to v1.3.0 |
| **Wave 4 Discovery** | **BR-41 to BR-51** | **11** | **Implemented (code-enforced, newly documented)** |

### Newly Discovered Rules (Wave 4)

| BR | Description | Module | Source | Type |
|----|------------|--------|--------|------|
| BR-41 | Election state machine: draft->nominationsOpen->votingOpen->awaitingConfirmation->published. Cancelled from any non-terminal. | elections | updateElectionStatus.ts | Explicit |
| BR-42 | One vote per person per position per election (ConflictError) | elections | castVote.ts | Explicit |
| BR-43 | Voting only when election.status === 'votingOpen' | elections | castVote.ts | Explicit |
| BR-44 | Election certification cross-module: ends outgoing terms, creates new terms, generates checklists | elections | certifyElection.ts | Explicit |
| BR-45 | Credit entry requires activityName non-empty + creditAmount > 0 | person/credits | createMyCreditEntry.ts | Explicit |
| BR-46 | Credit cycle auto-computed from registrationDate + activityDate + cyclePeriodYears | person/credits | credit-cycle.ts | Explicit |
| BR-47 | Banned/suspended users rejected at auth middleware level | auth | middleware/auth.ts | Explicit |
| BR-48 | Bulk payment batch size has MAX_BATCH_SIZE limit | dues | bulkRecordPayments.ts | Explicit |
| BR-49 | requireActiveStatus allows both 'active' and 'grace' membership | auth | org-auth.ts | Explicit |
| BR-50 | Election date ordering enforced at DB level (CHECK constraints) | elections | elections.schema.ts | Explicit |
| BR-51 | Internal service token timing-safe comparison against rotated token list | auth | middleware/auth.ts | Explicit |

**Summary:** 45/51 rules implemented. 28 STRONG tested, 3 WEAK, 14 implemented but test coverage varies, 6 NONE (deferred v1.3.0).

---

## 8. API Surface Summary

**Total Endpoints:** 360 (from OpenAPI spec) + 8 hand-wired = 368

### TypeSpec vs Hand-Wired vs Dark Routes

| Category | Count | Details |
|----------|-------|---------|
| TypeSpec -> OpenAPI | 360 | Generated routes with validators |
| Hand-wired (app.ts) | 8 | email unsubscribe (2), suppressions (1), accredited-providers (4), other (1) |
| **Dark modules** | **~30-50 est** | **advertising (11 handlers), marketplace (13), jobs (9) -- schemas exist, no OpenAPI** |

### 8b. API Contract Drift

No per-module `API_CONTRACTS.md` files exist. Operating in pure extraction mode.

### Error Handling Inconsistency (P1)

| Pattern | Count | Issue |
|---------|-------|-------|
| `throw new Error('...')` (generic) | 130 | Produces unstructured 500s, bypasses AppError hierarchy |
| `c.json({error}, status)` (direct) | 325 | Bypasses centralized error handler |
| `throw new AppError(...)` (proper) | Used in core | Correct pattern with error codes |

Two error paths coexist in same handlers. Generic `throw new Error()` loses error context for clients.

### Consistency Findings

| Area | Status | Notes |
|------|--------|-------|
| Pagination | Consistent | `OffsetPaginationParams` from `pagination.tsp` |
| Response format | Consistent | `c.json()` across all handlers |
| Auth middleware | Consistent | Global + per-handler guards |
| Rate limiting | Consistent | 30 write/120 read per IP per minute |
| Security headers | Consistent | Hono `secureHeaders()` on all responses |
| CORS | Consistent | Dynamic origin validation |
| Input validation | Consistent | `zValidator` on all generated routes |

---

## 9. State Machines Summary

### Status Enums (25+ state machines across 16+ modules)

| Module | Enum | Values | Transition Guards? | Delta |
|--------|------|--------|-------------------|-------|
| **Membership** | membershipStatusEnum | pendingPayment, active, gracePeriod, lapsed, expired, suspended, terminated, resigned, deceased, expelled | **Yes** -- BR-03, computed | -- |
| **Membership** | applicationStatusEnum | submitted, underReview, approved, denied, waitlisted | **Yes** | -- |
| **Dues** | duesPaymentStatusEnum | pending, completed, failed, refunded, partiallyRefunded, expired, submitted, underReview, confirmed, rejected | **Partial** -- handler-level guards but no centralized VALID_TRANSITIONS map | DOWNGRADE |
| **Dues** | duesInvoiceStatusEnum | generated, sent, paid, overdue, cancelled, writtenOff | **Yes** -- optimistic locking | -- |
| **Booking** | bookingStatusEnum | pending, confirmed, rejected, cancelled, completed, no_show_client, no_show_host | **Partial** -- handler-level guards, no centralized map | DOWNGRADE |
| **Elections** | electionStatusEnum | draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled | **Yes** -- explicit VALID_TRANSITIONS map | -- |
| **Training** | trainingStatusEnum | draft, published, cancelled, completed | **Yes** | -- |
| **Events** | eventStatusEnum | draft, published, cancelled, completed | **Yes** | -- |
| **Advertising** | campaignStatusEnum | draft, pending_review, active, paused, completed | **None** | NEW |
| **Jobs** | jobApplicationStatusEnum | applied, screening, interviewed, offered, hired | **None** | NEW |
| **Credentials** | licenseStatusEnum | active, expired, suspended, revoked, pending | Minimal | -- |
| **Communications** | messageStatusEnum | draft, scheduled, sending, sent, cancelled, failed | Partial | -- |
| **Documents** | documentStatusEnum | draft, published, archived | Minimal | -- |

### 9b. Domain Model Drift

Compared extracted entities against `docs/product/DOMAIN_MODEL.md`:

| Category | Count | Severity |
|----------|-------|----------|
| Undocumented entities (in code, not in DOMAIN_MODEL) | 18 | P1 |
| Aggregate boundary violations | 0 | -- |
| Missing domain events (declared, not published) | 15+ | P2 |
| State machine drift (documented match code) | 0 | -- |

**Undocumented entities** primarily from: advertising (5 tables: advertiser, ad_campaign, ad_creative, ad_report, royalty_split), marketplace (3: vendor, marketplace_listing, marketplace_order), jobs (2: job_posting, job_application), committee management (3: committee, committee_member, committee_task), dunning (2: dunning_template, dunning_event), other (3).

**Guarded state machines that ARE documented match DOMAIN_MODEL exactly** -- no drift in documented machines.

---

## 10. UI / Screens Summary

### Routes Per App

| App | Routes | Port | Purpose | SDK Usage |
|-----|--------|------|---------|-----------|
| memberry | 70 | 3004 | Product app -- membership, dues, events, training | @monobase/sdk-ts (17+ routes) |
| account | 16 | 3002 | Auth, profile, settings, onboarding | @monobase/sdk-ts |
| admin | 11 | 3003 | Ops dashboard -- associations, members, audit, flags | @monobase/sdk-ts (fully migrated) |

### Memberry App Structure (70 routes)

| Route Group | Screens | Backend Modules |
|-------------|---------|-----------------|
| `/dashboard` | 1 | events, training, dues, elections, communications |
| `/my/*` | 13 | person, certificates, credits, events, payments, training, notifications |
| `/org/$orgId/*` | ~15 | association:member, events, dues, elections, training |
| `/org/$orgId/officer/*` | ~35 | roster, communications, elections, events, training, reports, settings, dues |
| `/onboarding` | 1 | person |
| `/org/$slug` | 1 | association:member (public page) |
| Auth | 2 | Better-Auth |

### Mock Data Contamination

No production code relying on mock data detected. Form placeholder text exists (normal UX). Feature component stubs in `apps/memberry/src/features/` are clearly separated.

### Component Architecture

- Each app inlines its own components (no shared `packages/ui/src/` at component level)
- `apps/memberry/src/components/ui/` is empty -- shadcn primitives may need re-installation
- Feature-organized: `apps/memberry/src/features/{dues,training,admin,certificates,chapters,directory}/`

---

## 11. Test Coverage Summary

### Per-Category Breakdown

| Category | Total Items | Tested | Coverage | Assertion Quality |
|----------|-----------|--------|----------|-------------------|
| Business rules | 51 | 45 | 88% | 28 STRONG, 3 WEAK, 14 varying, 6 deferred |
| Permissions (role x action) | ~60 | 55+ | 92% | STRONG (integration tests) |
| API endpoints | 368 | ~310 | 84% | Mix STRONG/WEAK |
| State transitions | 25+ machines | 20 | 80% | STRONG for core |
| Validation rules | ~100 | ~80 | 80% | STRONG (Zod + TypeSpec) |
| UI components | ~60 | 54 tested | 90% | Mix (memberry only) |
| UI interactions | ~30 critical | ~25 | 83% | STRONG (Playwright) |
| Interaction states | ~270 | ~100 | 37% | STRONG (10 screens) |
| Accessibility | ~50 elements | ~18 | 36% | ADEQUATE (axe-core) |

### Backend Assertion Quality

| Type | Count | Percentage |
|------|-------|------------|
| **Strong** (toBe, toEqual, toStrictEqual, toThrow, toContain, toMatch) | 6,865 | **91.4%** |
| **Weak** (toBeDefined, toBeTruthy, toBeFalsy, toBeNull) | 643 | **8.6%** |

### Test Type Classification Per Module

| Module | Unit | Integration | E2E | Component | Contract | Total |
|--------|------|-------------|-----|-----------|----------|-------|
| association:member | 44 | 0 | ~15 | 2 | 41 | ~102 |
| communication | 35 | 0 | ~5 | 0 | 4 | ~44 |
| dues | 16 | 0 | ~8 | 16 | 4 | ~44 |
| person | 32 | 0 | ~5 | 0 | 3 | ~40 |
| platformadmin | 24 | 0 | ~6 | 0 | 3 | ~33 |
| training | 18 | 0 | ~8 | 4 | 1 | ~31 |
| booking | 24 | 0 | 0 | 0 | 6 | 30 |
| membership | 23 | 0 | ~5 | 0 | 2 | ~30 |
| events | 16 | 0 | ~8 | 0 | 2 | ~26 |
| billing | 21 | 0 | 0 | 0 | 3 | 24 |
| documents | 18 | 0 | ~3 | 0 | 1 | ~22 |
| elections | 15 | 0 | ~5 | 0 | 1 | ~21 |
| email | 17 | 1 | 0 | 0 | 2 | 20 |
| assoc:operations | 13 | 0 | ~3 | 0 | 0 | ~16 |
| certificates | 7 | 0 | ~2 | 2 | 1 | ~12 |
| comms | 5 | 0 | ~3 | 0 | 3 | ~11 |
| notifs | 7 | 0 | 0 | 0 | 2 | 9 |
| audit | 4 | 1 | ~2 | 0 | 2 | ~9 |
| advertising | 7 | 0 | 0 | 0 | 0 | 7 |
| jobs | 7 | 0 | 0 | 0 | 0 | 7 |
| reviews | 5 | 0 | 0 | 0 | 1 | 6 |
| invite | 4 | 0 | 0 | 0 | 0 | 4 |
| storage | 2 | 0 | 0 | 0 | 2 | 4 |
| marketplace | 3 | 0 | 0 | 0 | 0 | 3 |
| Cross-cutting | 1 | 7 | ~15 | 1 | 5 | ~29 |
| **TOTAL** | **~407** | **9** | **~92** | **25+** | **97** | **~630** |

### BR-Test Traceability

- **40 BRs** defined in `docs/ver-3/business/br-registry.json`
- **0/40** have `testFile` mappings in registry (all show "no-test")
- **11 BR-specific test files** exist in handler directories (`br-*.test.ts`)
- **21 test.todo** entries reference BR gaps
- **Gap**: BR registry disconnected from test files

### Test Gaps

- **Admin and account apps**: 0 component tests -- only E2E
- **Advertising, marketplace, jobs**: unit tests only, 0 E2E/contract/component
- **BR-25 OTP rate limiting**: delegated to Better-Auth, no dedicated test
- **11 test.todo items** in `membership/br-p2-gap.test.ts` (visibility defaults, license normalization, session management)

---

## 12. Security Audit (OWASP Top 10)

| Category | Status | Severity | Evidence |
|----------|--------|----------|----------|
| **A01: Broken Access Control** | PASS | -- | 4-layer auth stack; all mutations protected; 2FA for privileged |
| **A02: Cryptographic Failures** | PASS | -- | Better-Auth password hashing; timing-safe token comparison |
| **A03: Injection** | PASS | -- | Drizzle ORM parameterizes all queries; raw `sql` only in seed/test files |
| **A04: Insecure Design** | LOW RISK | P3 | DeferredScopeError (501) prevents silent failures |
| **A05: Security Misconfiguration** | PASS | -- | `secureHeaders()` middleware; `applySecurity()` strips sensitive fields |
| **A06: Vulnerable Components** | N/A | -- | Recommend `bun audit` in CI |
| **A07: Auth Failures** | PASS | -- | Better-Auth sessions; banned user rejection; account lockout; passkeys |
| **A08: Data Integrity** | PASS | -- | Optimistic locking (`version` field); `createdBy`/`updatedBy` audit |
| **A09: Logging Failures** | YELLOW | P2 | 2 locations log user emails: `core/billing.ts:123`, `core/auth.ts:147` |
| **A10: SSRF** | PASS | -- | No server-side URL fetching with user input |

### Additional Security Findings

| ID | Severity | Finding | File | Status |
|----|----------|---------|------|--------|
| SEC-01 | MEDIUM | `/email/suppressions` route lacks visible `authMiddleware()` | app.ts:142 | OPEN |
| SEC-02 | LOW | `createElection` raw SQL with Drizzle parameterization (safe) | elections/createElection.ts | ACCEPTABLE |
| SEC-03 | INFO | PRIVILEGED_POSITIONS Set duplicated in officer-auth.ts and officer-check.ts | Both files | Should consolidate |
| SEC-04 | P2 | Email logged at info level in billing.ts | core/billing.ts:123 | OPEN |
| SEC-05 | P2 | Email logged at info level in auth.ts | core/auth.ts:147 | OPEN |

**Overall Security Score: 8.9/10** -- 0 P0, 0 P1, 3 P2, 4 P3

---

## 13. Observability Audit

| Dimension | Status | Evidence |
|-----------|--------|----------|
| **Structured Logging** | PASS | Pino logger; JSON output; child loggers with request context |
| **Request IDs** | PASS | `X-Request-ID` header; UUID fallback; propagated to errors and child loggers |
| **Correlation IDs** | PARTIAL | Request ID serves as correlation; no `traceparent` header |
| **Health Checks** | PASS | `/livez` (no deps), `/readyz` (checks DB, storage, jobs); `application/health+json` |
| **Error Tracking** | PASS | Structured context (path, method, requestId, error code) |
| **Audit Trail** | PASS | Global audit middleware auto-logs all write operations |
| **Job Monitoring** | PASS | pg-boss health integrated into `/readyz` |
| **Metrics** | NONE | No Prometheus/StatsD/custom metrics endpoint |
| **Distributed Tracing** | NONE | No traceparent propagation |

**Overall Observability Score: 9.3/10**

---

## 14. Performance Audit

| Issue | Severity | Location | Evidence |
|-------|----------|----------|----------|
| **Unbounded queries** | P2 | governance.repo.ts (7), communication.repo.ts (2) | `.select()` without `.limit()` on org-scoped list queries |
| **Bulk payment N+1** | P2 | bulkRecordPayments.ts | Individual inserts per row (intentional partial-failure, but batchable) |
| **In-memory rate limiter** | P2 | middleware/rate-limit.ts | Map-based; no multi-instance coordination |
| **N+1 prevention** | GOOD | Multiple handlers | Correct `inArray()` batching, `Promise.all` patterns |
| **Index coverage** | GOOD | dues schemas | Comprehensive indexes on frequently queried fields |

**Overall Performance Score: 8.5/10** -- 3 P2, 0 P0/P1

---

## 15. Inconsistency Report

### 15a. Active Pattern Inconsistencies

| ID | Type | Description | Severity |
|----|------|-------------|----------|
| INC-01 | Naming | `orgId` vs `organizationId` in TypeSpec (42 vs 47) | Low |
| INC-05 | Schema | `dues_config` vs `dues_org_config` similarly-named tables | Low |
| INC-06 | Error handling | 130 generic `throw new Error()` + 325 direct `c.json()` bypass error handler | P1 (NEW) |
| INC-07 | File naming | 2 kebab-case handler files among 200+ camelCase | P3 (NEW) |
| INC-08 | Module naming | Plural/singular mix (events vs event, documents vs document) | P3 (NEW) |

### 15b. Stub & TODO Inventory

| Category | Count | Severity |
|----------|-------|----------|
| Runtime stubs (handlers returning empty/default) | 8 (association:member institutional membership CRUD) | P1 |
| Unimplemented function (`core/audit.ts markForPurging`) | 1 | P2 (GDPR gap) |
| TODO markers in billing handlers | 14 | P2 |
| Dead template comments in stub handlers | 40 | P3 |
| test.todo items | 21 | P3 |

**Summary:** 8 runtime stubs (P1), 15 incomplete stubs (P2), 61 TODO markers (P3)

### 15c. Type Cast Density

| Scope | `as any` | `as unknown` | `@ts-ignore` | Total | Casts/File |
|-------|----------|--------------|-------------|-------|------------|
| Production handlers (api-ts/src/) | 439 | -- | 0 | 439 | ~2.3 |
| Test files | 1,487 | -- | 0 | 1,487 | ~3.7 |
| Frontend apps | -- | -- | 0 | -- | -- |

**69% of `as any` casts are in test files** (mock contexts -- acceptable). Zero `@ts-ignore` in api-ts. No files above >10 casts threshold flagged.

### 15d. Cross-Module Import Violations

| Source Module | Target Module | Import Count | Bidirectional? | Severity |
|--------------|--------------|-------------|----------------|----------|
| association:member | dues | ~25 | **YES** | P1 |
| association:member | person | ~15 | **YES** | P1 |
| association:member | membership | ~8 | **YES** | P1 |
| person | association:member | ~15 | YES (counted above) | P1 |
| dues | association:member | ~25 | YES (counted above) | P1 |
| elections | association:member | ~5 | No | P2 |
| association:operations | association:member | ~10 | No | P2 |
| email | association:member | ~3 | No | P2 |

**3 bidirectional coupling pairs** (P1). `association:member` has >3 cross-module imports (P2 threshold exceeded).

### 15e. Cross-Module Raw SQL

**Zero cross-module raw SQL found.** All raw `sql` template literals reference tables within their own module schema. Drizzle ORM enforces this boundary naturally.

### 15f. Security Audit (OWASP)

See Section 12.

### 15g. Observability Audit

See Section 13.

### 15h. Performance Anti-Patterns

See Section 14.

### Resolved (Wave 1+2+3)

| ID | Type | Resolution |
|----|------|-----------|
| INC-02 | Architecture | 3 communication modules -- actually 2, documented |
| INC-03 | SDK | Admin app raw fetch -- migrated to SDK |
| INC-04 | Testing | association:operations test gap -- 169 tests |

---

## 16. Repository Guardrails Review

| File | Exists? | Accurate? | Gaps | Action |
|------|---------|-----------|------|--------|
| README.md | Yes | Yes | None | Maintain |
| CONTRIBUTING.md | Yes | Yes -- 2,449 lines, comprehensive | None | Maintain |
| CLAUDE.md | Yes | **Stale claims** | Skills: 17->20, Handlers: 22->25, Contract tests: 27->97 | **Update counts (P2)** |
| VERTICAL_TDD.md | Yes | Yes | None | Maintain |
| docs/ARCHITECTURE.md | Yes | Mostly | Contract test count stale | Update |
| docs/product/DOMAIN_GLOSSARY.md | Yes | Yes | None | Maintain |
| docs/product/MASTER_PRD.md | Yes | Yes | None | Maintain |
| docs/product/MODULE_MAP.md | Yes | Mostly | Handler counts stale | Update |
| docs/product/ROLE_PERMISSION_MATRIX.md | Yes | Yes -- 195 rows | None | Maintain |
| docs/product/DOMAIN_MODEL.md | Yes | **18 tables missing** | New modules not documented | **Update (P1)** |
| docs/templates/ | **MISSING** | -- | No standardized templates | Create if needed |
| docs/checklists/ | **MISSING** | -- | No checklists | Create if needed |
| .github/workflows/ | Yes | contract.yml only | No lint/typecheck/build CI | P3 |

---

## 17. PRD / Spec Coverage Review

| Artifact | Exists? | Matches Code? | Quality | Action |
|----------|---------|--------------|---------|--------|
| MASTER_PRD.md | Yes | Yes | Good | Maintain |
| DOMAIN_GLOSSARY.md | Yes | Yes | Good | Maintain |
| MODULE_MAP.md | Yes | Mostly | Handler counts stale | Update |
| ROLE_PERMISSION_MATRIX.md | Yes | Yes | Good (195 rows) | Maintain |
| DOMAIN_MODEL.md | Yes | **18 tables missing** | Needs update | **Update** |
| UI_BLUEPRINT.md | Yes | Yes | Good (new) | Maintain |
| SEED_MANIFEST.md | Yes | Yes | Good | Maintain |
| TRACE_MATRIX.md | Yes | Yes (recently fixed) | Good | Maintain |
| EVENT_CONTRACTS.md | Yes | Yes | Good (10 jobs) | Maintain |
| WORKFLOW_MAP.md | Yes | Yes (v1.0) | Good | Maintain |
| Module specs (19/19) | **All present** | Yes | Good | Maintain |
| VERTICAL_SLICE_PLAN.md | Yes | Yes | Good | Maintain |
| Individual slice files | **MISSING** | -- | Not created yet | Create when executing |

### Contract Drift: API Surface vs Documentation

| Dimension | Docs Say | Code Reality | Drift? |
|-----------|----------|-------------|--------|
| Runtime | Bun 1.2.21 | Bun 1.2.21 | No |
| Handler modules | 22 | 25 | **Yes** |
| Skills | 17 | 20 | **Yes** |
| Contract tests | 27 scenarios | 97 .hurl files | **Yes** |
| Module specs | Not tracked | 19/19 present | No (improvement) |

---

## 18. Standards Gap Matrix

| Gap ID | Description | Priority | Status |
|--------|------------|----------|--------|
| GAP-01 | Hand-wired routes in app.ts | CLOSED | Intentional |
| GAP-02 | Admin app raw fetch | CLOSED | Migrated to SDK |
| GAP-03 | No formal bounded context boundaries | P3 | v1.3.0+ |
| GAP-04 | Pagination inconsistency | CLOSED | False positive |
| GAP-05 | 6 business rules deferred (BR-35 to BR-40) | P3 | v1.3.0 |
| GAP-06 | orgId vs organizationId naming | P3 | Fix when touching |
| GAP-07 | No accessibility testing | CLOSED | axe-core added |
| GAP-08 | Interaction state coverage | IMPROVED | Now 37% |
| GAP-09 | Communication module overlap | CLOSED | Documented |
| GAP-10 | association:operations test gap | CLOSED | 169 tests |
| GAP-11 | storage module test gap | CLOSED | 46 cases |
| GAP-12 | ROLE_PERMISSION_MATRIX missing | CLOSED | 195 rows |
| GAP-13 | STATE.md stale | P3 | Update |
| GAP-14 | Failing tests | P1 | Needs triage |
| GAP-15 | No metrics/monitoring endpoint | P2 | No Prometheus |
| GAP-16 | Unbounded repo queries | P2 | 9 locations |
| GAP-17 | Rate limiter not persistent | P2 | In-memory |
| GAP-18 | No distributed tracing | P3 | No traceparent |
| **GAP-19** | **3 dark modules (no OpenAPI/TypeSpec)** | **P1** | **NEW -- advertising, marketplace, jobs** |
| **GAP-20** | **18 tables missing from DOMAIN_MODEL.md** | **P1** | **NEW** |
| GAP-21 | SEC-01: /email/suppressions auth | CLOSED | FALSE POSITIVE -- covered by `/email/*` wildcard middleware |
| GAP-22 | 9 stub handlers in association:member | P3 | DOWNGRADED -- all use DeferredScopeError (501). No crash risk |
| **GAP-23** | **3 bidirectional import pairs** | **P1** | **NEW -- circular dependency risk** |
| **GAP-24** | **Error handling inconsistency (130+325)** | **P1** | **NEW -- two error paths** |
| **GAP-25** | **CLAUDE.md stale counts** | **P2** | **NEW** |
| **GAP-26** | **BR registry disconnected from tests** | **P2** | **NEW -- 0/40 mapped** |
| **GAP-27** | **No centralized state transition maps for dues/booking** | **P2** | **NEW** |
| **GAP-28** | **markForPurging not implemented (GDPR)** | **P2** | **NEW** |
| **GAP-29** | **PII in logs (billing.ts, auth.ts)** | **P2** | **NEW** |

---

## 19. Risk Assessment

### P0 Risks (Fix Immediately)
None confirmed. (Dues/booking state machine guards exist at handler level, downgraded from initial P0 finding.)

### P1 Risks (Fix Before Major New Work)
1. **GAP-14:** Failing tests -- stabilize before v1.3.0
2. **GAP-19:** 3 dark modules need TypeSpec/OpenAPI exposure
3. **GAP-20:** 18 tables missing from DOMAIN_MODEL.md
4. ~~GAP-21: SEC-01 `/email/suppressions`~~ CLOSED (false positive -- covered by wildcard middleware)
5. ~~GAP-22: stub handlers~~ DOWNGRADED to P3 (DeferredScopeError pattern, no crash risk)
6. **GAP-23:** 3 bidirectional import pairs (circular dependency risk)
7. **GAP-24:** Error handling inconsistency (130 generic throws + 325 direct c.json)

### P2 Risks (Fix When Touching Module)
1. **GAP-15:** No metrics endpoint
2. **GAP-16:** 9 unbounded repo queries
3. **GAP-17:** In-memory rate limiter
4. **GAP-25:** CLAUDE.md stale counts
5. **GAP-26:** BR registry disconnected from tests
6. **GAP-27:** No centralized state transition maps for dues/booking
7. **GAP-28:** markForPurging not implemented (GDPR)
8. **GAP-29:** PII in logs

### P3 Risks (Improve Later)
1. **GAP-03:** Bounded context formalization
2. **GAP-05:** Deferred BRs (BR-35 to BR-40)
3. **GAP-06:** orgId naming standardization
4. **GAP-13:** STATE.md update
5. **GAP-18:** Distributed tracing
6. CI expansion (lint/typecheck/build workflows)

### Resolved Since Last Audit
All P0/P1 issues from prior audits remain resolved. No regression on previously fixed items.

---

## 20. Stabilization Plan

### Fix Immediately
1. **Add `authMiddleware()` to `/email/suppressions`** (SEC-01 -- data exposure risk)
2. **Triage failing tests** -- categorize as broken-code vs flaky vs env-dependent

### Fix Before Major New Work (v1.3.0 planning)
1. Add TypeSpec definitions for advertising, marketplace, jobs modules
2. Update DOMAIN_MODEL.md with 18 missing tables
3. Replace 8 stub handlers in association:member with implementations or remove routes
4. Standardize error handling: migrate generic `throw new Error()` to AppError hierarchy
5. Resolve 21 test.todo items
6. Update CLAUDE.md stale counts

### Fix When Touching Module
1. Add centralized VALID_TRANSITIONS maps to dues_payment and booking state machines
2. Add `.limit()` guards to 9 unbounded repo queries
3. Redact PII in billing.ts:123 and auth.ts:147 log statements
4. Implement `markForPurging` in core/audit.ts (GDPR)
5. Wire BR registry to test files
6. Add TypeSpec when modifying hand-wired routes

---

## 21. Standards Adoption Plan

### Phase 1: Add Guardrails -- COMPLETE
- README.md, CONTRIBUTING.md, CLAUDE.md, VERTICAL_TDD.md all exist
- 20 Claude Code skills active
- CI with contract testing

### Phase 2: Document Current Reality -- COMPLETE
- MASTER_PRD.md, DOMAIN_GLOSSARY.md, MODULE_MAP.md, ROLE_PERMISSION_MATRIX.md
- 19/19 module specs, UI_BLUEPRINT.md, DOMAIN_MODEL.md
- WORKFLOW_MAP.md, TRACE_MATRIX.md, SEED_MANIFEST.md, EVENT_CONTRACTS.md

### Phase 3: Stabilize Risky Areas -- COMPLETE
- All P0/P1 security issues resolved (prior waves)
- RBAC fully wired
- Core state machine guards in place
- 2FA enforcement for privileged roles

### Phase 4: Adopt Vertical Slice TDD -- IN PRACTICE
- VERTICAL_TDD.md documents protocol
- 407 backend tests + 101 E2E + 54 component tests demonstrate adoption
- 91% strong assertion quality

### Phase 5: Migrate Existing Code Gradually -- ONGOING
- 14/24 modules have TypeSpec (58%)
- 3 dark modules need TypeSpec exposure (advertising, marketplace, jobs)
- 7 modules hand-wired (migrate when touching)

---

## 22. Recommended First 3 Vertical Slices

| Rank | Slice | Module | Why This Slice | Risk | Expected Work |
|------|-------|--------|---------------|------|---------------|
| 1 | **Auth fix + dark module exposure** | email, advertising, marketplace, jobs | SEC-01 data exposure + 3 modules invisible to SDK consumers | Medium | 2-3 days |
| 2 | **Error handling standardization** | Core + all handlers | 130 generic throws + 325 direct c.json create inconsistent client experience | Medium | 2-3 days |
| 3 | **State machine formalization** | dues, booking | Add centralized VALID_TRANSITIONS maps alongside existing handler guards | Low | 1-2 days |

---

## 23. DDD Concepts

### Aggregate Roots (15)

Person, Membership, Organization, Association, Dues Invoice, Booking, Event, Training, Election, Chat Room, Certificate, Credential Template, Vendor (NEW), Ad Campaign (NEW), Job Posting (NEW)

### Entities (5 non-root)

Officer Term, Credit Entry, Dues Payment, Event Registration, Training Enrollment

### Value Objects (5)

BillingCycle, ComputedMembershipStatus, CreditCycle, RefundEligibility, Notification Preference

### Domain Events (Inferred, not implemented)

No explicit domain event system exists. All cross-module communication is direct import. Inferred events:
- Membership: 4 events (Approved, Suspended, Resigned, Deceased)
- Billing: 3 events (InvoiceGenerated, PaymentConfirmed, PaymentRefunded)
- Training: 2 events (Completed, CreditAwarded)
- Events: 3 events (Published, Cancelled, Completed)
- Governance: 3 events (OfficerTermCreated, ElectionOpened, ElectionPublished)
- Marketplace: 1 event (VendorApproved) -- NEW
- Advertising: 2 events (CampaignActivated, CampaignPaused) -- NEW
- Elections: missing notification triggers for certification

### Cross-Module Patterns

| Pattern | Count | Quality |
|---------|-------|---------|
| Direct schema import | 15+ | Tight coupling |
| Direct repo import | 10+ | Person and Dues most coupled |
| Bidirectional imports | 3 pairs | P1 -- circular dependency risk |
| Event-driven communication | 0 | No event bus |
| API-mediated communication | 0 | No internal REST/gRPC |
| Cross-module raw SQL | 0 | Clean -- Drizzle enforces boundary |

---

## 24. Health Score (19 Dimensions)

| # | Dimension | Score (0-10) | Evidence | Delta |
|---|-----------|-------------|----------|-------|
| 1 | Terminology consistency | 7 | orgId/organizationId split; 6 terminology conflicts; dues_config naming | -- |
| 2 | Permission coverage | 9 | 4-layer auth stack; 31 role combos; all mutations protected; 2FA | -- |
| 3 | Business rule clarity | 9 | 51 rules documented (up from 40); 88% implemented; 28 STRONG | +0 |
| 4 | API consistency | 8 | 360 endpoints consistent BUT 3 dark modules + 2 error path patterns | -1 |
| 5 | State machine safety | 8 | Core guarded; dues/booking lack centralized maps; 3 new modules unguarded | -1 |
| 6 | Error handling uniformity | 7 | AppError hierarchy exists BUT 130 generic throws + 325 direct c.json | -2 |
| 7 | Backend test coverage | 9 | 407 files; 91% strong assertions; significant growth | +1 |
| 8 | Frontend test coverage | 8 | 54 component + 101 E2E; admin/account 0 component tests; state coverage 37% | -- |
| 9 | PRD/spec coverage | 10 | 19/19 module specs; full OLI pipeline; all product artifacts present | +1 |
| 10 | UI prototype readiness | 8 | 97 routes; no mock contamination; UI_BLUEPRINT.md complete | -- |
| 11 | Architecture alignment | 9 | Spec-first; TDD adopted; CI; no contract drift | -- |
| 12 | Domain model clarity | 7 | DDD classification present BUT 18 tables missing from DOMAIN_MODEL.md | -1 |
| 13 | Security posture | 9 | OWASP pass; 0 P0/P1; SEC-01 medium (suppressions route) | -- |
| 14 | Observability | 9 | Pino structured; correlation IDs; K8s health endpoints; audit trail | +2 |
| 15 | Performance safety | 8 | 9 unbounded queries (down from 20); good batching patterns | +1 |
| 16 | Stub density | 7 | 8 runtime stubs (P1); 15 incomplete (P2); 61 TODO markers | NEW |
| 17 | Type cast density | 8 | 439 `as any` production (2.3/file); 0 `@ts-ignore`; 69% in tests | NEW |
| 18 | Cross-module coupling | 6 | 3 bidirectional pairs; association:member imported by 6+ modules; no ACLs | NEW |
| 19 | Raw SQL leakage | 10 | Zero cross-module raw SQL; Drizzle enforces boundaries | NEW |

**Overall Health: 8.2/10** (156/190)

**Score methodology change:** Expanded from 15 to 19 dimensions (added Stub Density, Type Cast Density, Cross-Module Coupling, Raw SQL Leakage). The lower normalized score (8.2 vs 8.7) reflects both new dimensions exposing previously untracked gaps AND more rigorous assessment of existing dimensions (error handling downgraded, API consistency downgraded).

---

## 25. Final Recommendations

### Do Now (P1)
1. **Fix SEC-01**: Add `authMiddleware()` to `/email/suppressions` route
2. **Triage failing tests** -- stabilize test suite before new work
3. **Expose dark modules** -- add TypeSpec for advertising, marketplace, jobs
4. **Update DOMAIN_MODEL.md** -- add 18 missing tables

### Do Next (P2)
5. Standardize error handling -- migrate 130 generic throws to AppError
6. Add centralized VALID_TRANSITIONS maps to dues_payment and booking
7. Update CLAUDE.md stale counts (skills: 20, handlers: 25, contracts: 97)
8. Redact PII in billing.ts and auth.ts logs
9. Wire BR registry to test files (0/40 mapped)
10. Implement `markForPurging` for GDPR compliance
11. Add `.limit()` to 9 unbounded repo queries

### Do Later (P3)
12. Formalize bounded context boundaries
13. Implement deferred BRs (BR-35 through BR-40)
14. Standardize orgId -> organizationId
15. Add distributed tracing (traceparent)
16. Migrate rate limiter to persistent store
17. Add CI workflows for lint/typecheck/build
18. Create `docs/templates/` and `docs/checklists/`

### Already Done (Wave 1+2+3+4)
- Backfill association:operations tests (169 tests)
- ROLE_PERMISSION_MATRIX.md (195 rows)
- DDD classification in DOMAIN_GLOSSARY.md
- Accessibility testing (axe-core + 18 E2E files)
- Interaction state tests (60 tests across 10 screens)
- Admin SDK migration (fully migrated)
- Full OLI pipeline completion (19/19 module specs)

### Avoid
- Big-bang bounded context refactor (wait for scale pain)
- Premature anti-corruption layers (direct imports acceptable at current scale)
- Rewriting hand-wired routes that work correctly (add TypeSpec when modifying)
- Adding distributed tracing before metrics (metrics first)
- Splitting association:member mega-module before v1.2.0 split plan executes

---

## Appendix A: Changes Since Wave 3 Audit (2026-05-19 -> 2026-05-20)

### New Modules Discovered
- **advertising** -- advertiser, ad_campaign, ad_creative, ad_report, royalty_split, member_ad_opt_out (6 tables)
- **marketplace** -- vendor, marketplace_listing, marketplace_order (3 tables)
- **jobs** -- job_posting, job_application (2 tables)

### New Business Rules Discovered
BR-41 through BR-51 (11 rules, primarily in elections and auth modules)

### New Gaps Found (Wave 4)
GAP-19 through GAP-29 (11 new gaps, 7 P1 + 4 P2)

### Score Evolution

| Audit Date | Dimensions | Raw Score | Normalized | Health |
|-----------|------------|-----------|------------|--------|
| 2026-05-13 | 12 | 98/120 (corrected) | 8.2/10 | Good |
| 2026-05-14 (Wave 2) | 12 | 102/120 | 8.5/10 | Good |
| 2026-05-19 (Wave 3) | 15 | 131/150 | 8.7/10 | Good |
| **2026-05-20 (Wave 4)** | **19** | **156/190** | **8.2/10** | **Good** |

### Metric Delta

| Metric | Wave 3 | Wave 4 | Delta |
|--------|--------|--------|-------|
| Handler modules | 22 | 25 | +3 |
| Backend test files | 336 | 407 | +71 |
| E2E test files | 132 | 101 | recount |
| Component test files | 44 | 54 | +10 |
| TypeSpec files | 37 | 55 | +18 |
| Schema files | 32 | 37 | +5 |
| pgTables | 80+ | 89 | +9 |
| pgEnums | 65 | 96 | +31 |
| Business rules | 40 | 51 | +11 |
| Frontend routes | 93 | 97 | +4 |
| Health dimensions | 15 | 19 | +4 |
| Health score | 8.7/10 | 8.2/10 | -0.5 (more rigorous) |
| P1 gaps | 1 | 7 | +6 |
| P2 gaps | 3 | 8 | +5 |

## Appendix B: Historical Corrections Preserved

These findings from May 13 were verified as incorrect and are NOT re-reported:
- "36 unprotected mutation routes" -- FALSE (global auth middleware protects all)
- "11 tables missing organizationId" -- MOSTLY FALSE (only invitation_token)
- "No pagination standard" -- FALSE (pagination.tsp exists)
- "Association:Member has 0 contract tests" -- FALSE (5 contract test files exist)
- "Duplicate dues_config export" -- FALSE (different table names)

## Appendix C: Database Table Inventory (89 tables)

Key tables by module:
- **Platform Admin:** association, organization, platform_admin, feature_flag, impersonation_session (5)
- **Person/Identity:** person, notification_preferences, person_privacy_settings, person_subscription (4)
- **Membership:** memberships, membership_applications, membership_categories, membership_tiers, membership_status_history, affiliation_transfer, chapter_affiliation, directory_profile (8)
- **Governance:** officer_term, position, committee, committee_member, committee_task, transition_checklist, disciplinary_action (7)
- **Elections:** election, election_nominee, election_vote (3)
- **Billing/Dues:** dues_config, dues_org_config, dues_payment, dues_invoice, dues_fund, dues_fund_allocation, dues_gateway_config, dues_category_override, dues_reminder_log, dues_reminder_schedule, dues_payment_status_history, invoice, invoice_line_item, merchant_account, aging_bucket, dunning_event, dunning_template (17)
- **Training/CPD:** training, training_enrollment, course, course_enrollment, accredited_provider, credit_entry, quiz_attempt (7)
- **Credentials:** credential_template, digital_credential, professional_license, license_renewal_alert, certificate (5)
- **Events:** event, event_registration, check_in, waitlist_entry (4)
- **Communication:** message, message_template, announcement, announcement_stats, subscription_topic, notification (6)
- **Comms (Real-Time):** chat_room, chat_message (2)
- **Documents:** document, document_version, document_tag, document_access_log (4)
- **Email:** email_queue, email_template (2)
- **Booking:** booking, booking_event, time_slot, schedule_exception (4)
- **Advertising (NEW):** advertiser, ad_campaign, ad_creative, ad_report, royalty_split, member_ad_opt_out (6)
- **Marketplace (NEW):** vendor, marketplace_listing, marketplace_order (3)
- **Jobs (NEW):** job_posting, job_application (2)
- **Other:** stored_file, review, invitation_token, audit_log_entry, webhook_retry_log (5)

---

**What's Next:**
- Fix SEC-01 `/email/suppressions` auth gap (P1 -- immediate)
- Expose advertising/marketplace/jobs via TypeSpec (P1)
- Update DOMAIN_MODEL.md with 18 missing tables (P1)
- `/oli-audit-compliance` -- verify specs match code
- `/oli-vertical-slice-plan` -- plan v1.3.0 implementation sequencing
- `/oli-confidence-stack` -- score test confidence across coverage layers
