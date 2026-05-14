# Existing Codebase Adoption Audit

---
**Audit Date:** 2026-05-14 (refreshed post-Wave 2)
**Source Directory:** /Users/elad-mini/Desktop/memberry
**Stack:** TypeScript + Hono + Drizzle ORM + React 19 + TanStack Router
**Previous Audit:** 2026-05-14 pre-Wave 2 (archived as EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-14.md)
---

## 1. Executive Summary

**Overall Health: 8.5/10** (corrected from 8.7 — previous audit had arithmetic error; dimension scores sum to 102/120)

**Top 3 Strengths:**
1. **Comprehensive test coverage** — 305 backend tests, 80+ E2E tests, 97 Hurl contract tests, 60 interaction state tests, 10 a11y baselines
2. **Strong auth/RBAC** — Global auth middleware + officer position checks + 2FA for privileged roles + platform admin isolation
3. **Spec-first architecture** — 17 TypeSpec modules generating 360 OpenAPI endpoints with full type safety end-to-end

**Top 3 Gaps:**
1. **DDD boundaries implicit** — Cross-module imports use direct `@/handlers/` paths (tight coupling); no formal bounded context separation or anti-corruption layers
2. **Admin app SDK gap** — Admin uses raw `fetch()` instead of `@monobase/sdk-ts` hooks
3. **3 communication modules overlap** — comms, communication, communications need consolidation

**Milestone Status:** v1.2.0 Pilot Launch — 31/31 requirements COMPLETE (Phases 18-25 shipped 2026-05-14)

**Wave 2 Improvements (this refresh):**
- ✅ Frontend interaction state tests added (60 tests across 10 screens)
- ✅ Accessibility baseline testing added (@axe-core/playwright)
- ✅ association:operations test backfill (169 tests, all 54 handlers covered)
- ✅ ROLE_PERMISSION_MATRIX.md created (195 rows)
- ✅ DDD classification added to DOMAIN_GLOSSARY.md

**Recommended Next Action:** Plan v1.3.0 with `/oli-vertical-slice-plan`. Communication module consolidation is the top remaining gap.

---

## 2. Project Overview

| Metric | Count |
|--------|-------|
| Handler modules | 21 |
| Handler files (non-test) | 553 |
| Backend test files | 305 |
| E2E test files | 80 (memberry) + 3 (account) + 6 (admin) = 89 |
| Interaction state test files | 10 (new — Wave 2) |
| A11y baseline tests | 10 (new — Wave 2) |
| Component test files | 44 |
| Hurl contract tests | 97 |
| OpenAPI endpoints | 360 |
| TypeSpec modules | 17 |
| Schema files | 31 |
| Database tables (pgTable) | 111 |
| Database enums (pgEnum) | 104 |
| Migrations | 38 |
| Frontend routes | 93 (memberry: 66, admin: 11, account: 16) |
| Business rules documented | 40 (BR-01 through BR-40) |
| Frontend apps | 3 (memberry, admin, account) |
| Backend services | 3 (api-ts, api-ts-embedded, cadence) |
| Shared packages | 4 (ui, sdk-ts, eslint-config, typescript-config) |

**Tech Stack:**
- **Runtime:** Bun 1.2.21
- **Backend:** Hono 4.0 + Drizzle ORM 0.44 + PostgreSQL
- **Frontend:** React 19 + Vite 7.1 + TanStack Router/Query
- **Auth:** Better-Auth 1.3.27 (JWT sessions, 2FA, impersonation)
- **API Spec:** TypeSpec 1.3 → OpenAPI 3.0
- **Testing:** Bun test + Vitest + Playwright 1.59 + Hurl
- **Jobs:** pg-boss 10.3 (PostgreSQL-backed)
- **Payments:** Stripe 19.1
- **Logging:** Pino 9.0

---

## 3. Project Structure

```
memberry/
├── apps/
│   ├── memberry/          # Product app (66 routes, port 3004)
│   ├── admin/             # Ops dashboard (11 routes, port 3003)
│   └── account/           # Auth/profile/settings (16 routes, port 3002)
│       └── src-tauri/     # Desktop wrapper (Rust + QuickJS)
├── services/
│   ├── api-ts/            # Reference API (21 handler modules, 553 files)
│   ├── api-ts-embedded/   # QuickJS bundle for offline Tauri
│   └── cadence/           # P2P sync engine (Rust + Iroh)
├── specs/api/             # TypeSpec definitions + OpenAPI output
│   ├── src/modules/       # 17 .tsp files
│   ├── dist/openapi/      # Generated OpenAPI spec (360 endpoints)
│   └── tests/contract/    # 97 Hurl contract tests
├── packages/
│   ├── ui/                # Shared Radix UI + Tailwind components
│   ├── sdk-ts/            # Generated TanStack Query hooks
│   ├── eslint-config/     # Shared ESLint flat configs
│   └── typescript-config/ # Shared TS configs
├── testing/               # Test factories, registry, scripts
├── docs/                  # Architecture, PRD, glossary, audits
├── .planning/             # GSD workflow artifacts
└── .claude/skills/        # 17 Claude Code skills
```

---

## 4. Module Map

### Handler Modules (21 modules)

| Module | Handler Files | Test Files | Test Ratio | TypeSpec? | Schema Files |
|--------|-------------|-----------|------------|-----------|-------------|
| association:member | 189 | 38 | 20% | Yes (via association routes) | 9 |
| association:operations | 59 | 10 | 17% | Yes (via association routes) | 2 |
| person | 31 | 29 | 94% | Yes (person.tsp, person-custom.tsp) | 3 |
| communication | 30 | 32 | 107% | Yes | 1 |
| platformadmin | 24 | 24 | 100% | Yes (platform-admin.tsp, platform-admin-custom.tsp) | 1 |
| booking | 31 | 23 | 74% | Yes (booking.tsp) | 1 |
| email | 21 | 17 | 81% | Yes (email.tsp) | 2 |
| billing | 18 | 20 | 111% | Yes (billing.tsp) | 1 |
| documents | 17 | 17 | 100% | No (hand-wired) | 1 |
| training | 16 | 16 | 100% | No (hand-wired) | 1 |
| membership | 14 | 21 | 150% | Yes (membership-custom.tsp) | 0 (uses association:member schemas) |
| comms | 14 | 3 | 21% | Yes (comms.tsp) | 1 |
| events | 11 | 13 | 118% | No (hand-wired) | 0 (uses association:operations schemas) |
| dues | 10 | 7 | 70% | Yes (dues-custom.tsp) | 2 |
| elections | 8 | 10 | 125% | No (hand-wired) | 1 |
| notifs | 8 | 6 | 75% | Yes (notifs.tsp, notifs-custom.tsp) | 1 |
| storage | 8 | 2 | 25% | Yes (storage.tsp) | 1 |
| invite | 6 | 4 | 67% | No (hand-wired) | 1 |
| reviews | 6 | 5 | 83% | Yes (reviews.tsp) | 0 |
| audit | 4 | 3 | 75% | Yes (audit.tsp) | 1 |
| certificates | 4 | 4 | 100% | No (hand-wired) | 1 |

**TypeSpec Coverage:** 14/21 modules (67%) have TypeSpec definitions. 7 remain hand-wired.

### Dependency Matrix (Cross-Module Imports)

| Importing Module | Imports From | Pattern |
|-----------------|-------------|---------|
| person | association:member (membership, credits, governance repos) | Direct import |
| person | platformadmin (organizations schema) | Direct import |
| dues | association:member (membership-lifecycle utils) | Direct import |
| dues | association:operations (events schema) | Direct import |
| dues | platformadmin (organizations schema) | Direct import |
| association:operations | association:member (membership, credits repos) | Direct import |
| email | association:member (membership schema) | Direct import |
| membership | association:member (membership schema) | Direct import |
| billing | person (person schema) | Direct import |
| communication | association:member (membership schema) | Direct import |

**Key Finding:** All cross-module communication uses **direct imports** (tight coupling). No event bus, no API-mediated communication, no anti-corruption layers. The `association:member` module is the most-depended-upon module (imported by 6+ others).

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

### Terminology Consistency

- **orgId vs organizationId:** `orgId` used 42 times in TypeSpec, `organizationId` used 47 times. Mixed usage — no single canonical form. Route params use `:organizationId`, but handler variables often use `orgId`.

### DDD Classification

| Entity | Classification | Aggregate Root? | Domain Events (Inferred) | Bounded Context |
|--------|---------------|----------------|-------------------------|-----------------|
| Person | Entity | Yes — owns notification preferences, privacy settings | PersonCreated, PersonUpdated, PersonAnonymized | Identity |
| Membership | Entity | Yes — owns applications, status history | MembershipApproved, MembershipSuspended, MembershipResigned, MembershipDeceased | Membership |
| Organization | Entity | Yes — owns positions, officer terms, dues configs | OrganizationCreated | Platform Admin |
| Association | Entity | Yes — owns organizations | AssociationCreated | Platform Admin |
| Officer Term | Entity | No — child of Organization | OfficerTermCreated, OfficerTermExpired | Governance |
| Credit Entry | Entity | No — child of Membership cycle | CreditAwarded, CreditVerified, CreditRejected | Training/CPD |
| Dues Invoice | Entity | Yes — owns payment records | InvoiceGenerated, InvoicePaid, InvoiceCancelled | Billing |
| Dues Payment | Entity | No — child of Dues Invoice | PaymentRecorded, PaymentConfirmed, PaymentRefunded | Billing |
| Booking | Entity | Yes — owns time slots | BookingConfirmed, BookingCancelled, BookingNoShow | Scheduling |
| Event | Entity | Yes — owns registrations, check-ins | EventPublished, EventCancelled, EventCompleted | Events |
| Training | Entity | Yes — owns enrollments | TrainingPublished, TrainingCompleted | Training/CPD |
| Election | Entity | Yes — owns nominations, ballots | ElectionOpened, ElectionPublished, ElectionCancelled | Governance |
| Chat Room | Entity | Yes — owns messages | ChatRoomCreated, ChatRoomArchived | Communications |
| Notification Preference | Value Object | No — owned by Person | — | Identity |
| Privacy Settings | Value Object | No — owned by Person | — | Identity |
| Address / Contact Info | Value Object | No — stored as JSONB on Person | — | Identity |
| Credential Template | Entity | No — owned by Organization | CredentialTemplateCreated | Credentials |

**Bounded Context Candidates:**
1. **Identity** — Person, notification preferences, privacy settings
2. **Membership** — Memberships, applications, status history, transfers
3. **Billing** — Dues configs, invoices, payments, fund allocations
4. **Training/CPD** — Training sessions, credit entries, compliance, accredited providers
5. **Governance** — Officer terms, positions, elections, nominations
6. **Events** — Events, registrations, check-ins, capacity management
7. **Communications** — Chat rooms, messages, video calls, announcements, templates
8. **Platform Admin** — Associations, organizations, feature flags, impersonation

**Anti-Corruption Layers Found:** None. All modules import directly from each other via `@/handlers/` paths.

**Anti-Corruption Layers Missing [INFERRED]:**
- Person ↔ Membership: person module directly imports membership repos (should query via API or shared interface)
- Dues ↔ Membership: dues directly imports membership-lifecycle utils (tight coupling to membership state machine)
- Email ↔ Membership: email directly imports membership schema for deceased/suppression checks

---

## 6. Permission Summary

### Roles

| Role | Scope | Source |
|------|-------|--------|
| client | System-wide | types/auth.ts |
| host | System-wide | types/auth.ts |
| admin | System-wide | types/auth.ts |
| user | Any authenticated | types/auth.ts (special meaning in middleware) |
| super | Platform admin | types/auth.ts (AdminPrivilegeLevel) |
| support | Platform admin | types/auth.ts (AdminPrivilegeLevel) |
| president | Org-scoped | utils/org-auth.ts (highest privilege) |
| vice-president | Org-scoped | utils/org-auth.ts |
| secretary | Org-scoped | utils/org-auth.ts |
| treasurer | Org-scoped | utils/org-auth.ts |
| board-member | Org-scoped | utils/org-auth.ts |
| officer | Org-scoped | utils/org-auth.ts |
| staff | Org-scoped | utils/org-auth.ts |
| member | Org-scoped | utils/org-auth.ts (lowest privilege) |

### Auth Middleware Stack

1. **Global auth middleware** (app.ts) — Applied to all routes except explicitly public ones
2. **Officer auth middleware** (officer-auth.ts) — Verifies active officer term for `:organizationId`; enforces 2FA for president/treasurer/secretary
3. **Platform admin middleware** (platform-admin-auth.ts) — Checks `platform_admin` table membership
4. **Handler-level guards** — `requirePosition()`, `requireOrgRole()`, `requireActiveStatus()`, `requireTenantAccess()`

### Public (Unprotected) Routes

| Route | Method | Purpose | Risk |
|-------|--------|---------|------|
| `/email/unsubscribe` | GET/POST | RFC 8058 one-click unsubscribe | Low — by design |
| `/association/member/credentials/public-verify` | GET | Credential verification page | Low — public API |
| `/association/member/ethics/public-complaints` | GET | Public ethics complaints | Low — public API |
| `/association/member/ethics/public-complaint` | POST | Submit ethics complaint | Low — captcha-protected |
| `/association/member/directory/public` | GET | Public member directory | Low — opt-in |
| `/association/member/directory/search` | GET | Public directory search | Low — opt-in |

### Handler-Level Auth Coverage

Officer auth (`requirePosition`/`requireOfficerTerm`) used in **60+ handler files** across:
- dues (getDuesDashboard)
- training (CRUD accredited providers)
- association:operations (all mutation handlers — create/update/delete training, events, courses, enrollments)
- association:member (all governance, dues, credential mutation handlers)

**Finding:** All mutation routes are protected. No unguarded mutation endpoints found.

---

## 7. Business Rules Summary

**Total: 40 business rules** (BR-01 through BR-40)

### Phase Coverage

| Phase | BR Range | Count | Status |
|-------|----------|-------|--------|
| Phase 1 | BR-01 to BR-32 | 32 | Implemented |
| Phase 2 | BR-33 to BR-37 | 5 | BR-33, BR-34 implemented; BR-35 to BR-37 deferred |
| Phase 3 | BR-38 to BR-40 | 3 | Deferred to v1.3.0 |

### Rule Classification

| BR | Description | Type | Confidence | Tested? |
|----|------------|------|------------|---------|
| BR-01 | Membership status computation | Explicit | HIGH | STRONG |
| BR-02 | Grace period default (30 days) | Explicit | HIGH | STRONG |
| BR-03 | Membership state transitions | Explicit | HIGH | STRONG |
| BR-04 | Dues amount per org | Explicit | HIGH | STRONG |
| BR-05 | Fund allocation (percentage split) | Explicit | HIGH | STRONG |
| BR-06 | Payment recording | Explicit | HIGH | STRONG |
| BR-07 | Dues expiry extension on payment | Explicit | HIGH | STRONG |
| BR-08 | Refund policy | Explicit | HIGH | STRONG |
| BR-09 | Officer role assignment | Explicit | HIGH | STRONG |
| BR-10 | Platform admin impersonation | Explicit | HIGH | STRONG |
| BR-11 | Credit cycle start | Explicit | HIGH | STRONG |
| BR-12 | Credit carry-over | Explicit | HIGH | STRONG |
| BR-13 | Auto vs manual credits | Explicit | HIGH | STRONG |
| BR-14 | Cross-org credit aggregation | Explicit | HIGH | STRONG |
| BR-15 | Training vs event distinction | Explicit | MEDIUM | WEAK |
| BR-16 | Activity visibility | Explicit | HIGH | STRONG |
| BR-17 | Attendance confirmation | Explicit | HIGH | STRONG |
| BR-18 | QR code authentication | Technical | HIGH | WEAK |
| BR-19 | ID card generation | Explicit | HIGH | STRONG |
| BR-20 | Certificate generation | Explicit | HIGH | STRONG |
| BR-21 | Multi-org member account | Explicit | HIGH | STRONG |
| BR-22 | Member matching on import | Explicit | HIGH | STRONG |
| BR-23 | License number format | Technical | HIGH | STRONG |
| BR-24 | Invitation expiry | Explicit | HIGH | STRONG |
| BR-25 | OTP registration | Technical | HIGH | STRONG |
| BR-26 | Session management | Technical | HIGH | STRONG |
| BR-27 | Event registration limits | Explicit | HIGH | STRONG |
| BR-28 | Communication deduplication | Technical | MEDIUM | WEAK |
| BR-29 | Org public page | Explicit | HIGH | STRONG |
| BR-30 | Payment gateway isolation | Technical | HIGH | STRONG |
| BR-31 | SVG upload security | Technical | HIGH | STRONG |
| BR-32 | Financial record retention | Explicit | HIGH | STRONG |
| BR-33 | Election integrity | Explicit | HIGH | STRONG |
| BR-34 | Nomination eligibility | Explicit | HIGH | STRONG |
| BR-35 | Feed content moderation | Explicit | LOW | NONE — deferred |
| BR-36 | National dashboard access | Explicit | LOW | NONE — deferred |
| BR-37 | Job posting expiry | Explicit | LOW | NONE — deferred |
| BR-38 | Marketplace referral disclosure | Explicit | LOW | NONE — deferred |
| BR-39 | Committee dissolution | Explicit | LOW | NONE — deferred |
| BR-40 | Survey anonymity | Explicit | LOW | NONE — deferred |

**Summary:** 34/40 rules implemented. 28 STRONG, 3 WEAK, 3 NONE (implemented but untested), 6 NONE (deferred v1.3.0).

---

## 8. API Surface Summary

**Total Endpoints:** 360 (from OpenAPI spec)

### TypeSpec vs Hand-Wired Routes

**Hand-wired routes in app.ts (7 routes):**
1. `GET /email/unsubscribe` — RFC 8058 unsubscribe
2. `POST /email/unsubscribe` — RFC 8058 unsubscribe
3. `GET /email/suppressions` — Suppression list
4. `GET /accredited-providers/:organizationId` — Provider list
5. `POST /accredited-providers/:organizationId` — Create provider
6. `PATCH /accredited-providers/:organizationId/:providerId` — Update provider
7. `DELETE /accredited-providers/:organizationId/:providerId` — Delete provider

All other routes are OpenAPI-generated from TypeSpec.

### Consistency Findings

| Area | Status | Notes |
|------|--------|-------|
| Pagination | Partial | `OffsetPaginationParams` defined in `pagination.tsp`; applied to some endpoints, not all list endpoints |
| Error shapes | Consistent | HTTPException used uniformly across 40+ handler files |
| Response format | Consistent | `c.json()` pattern across all handlers |
| Auth middleware | Consistent | Global middleware + per-handler guards |
| Status codes | Consistent | 400/403/404/409/500 used appropriately |

---

## 9. State Machines Summary

### Status Enums (25 state machines across 16 modules)

| Module | Enum | Values | Transition Guards? |
|--------|------|--------|-------------------|
| **Membership** | membershipStatusEnum | pendingPayment, active, gracePeriod, lapsed, expired, suspended, terminated, resigned, deceased, expelled | Yes — BR-03 enforced |
| **Membership** | applicationStatusEnum | submitted, underReview, approved, denied, waitlisted | Yes |
| **Dues** | duesPaymentStatusEnum | pending, completed, failed, refunded, partiallyRefunded, expired, submitted, underReview, confirmed, rejected | Yes |
| **Dues** | duesInvoiceStatusEnum | generated, sent, paid, overdue, cancelled, writtenOff | Yes — optimistic locking |
| **Booking** | bookingStatusEnum | pending, confirmed, rejected, cancelled, completed, no_show_client, no_show_host | Yes |
| **Elections** | electionStatusEnum | draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled | Yes |
| **Training** | trainingStatusEnum | draft, published, cancelled, completed | Yes |
| **Events** | eventStatusEnum | draft, published, cancelled, completed | Yes |
| **Events** | registrationStatusEnum | confirmed, waitlisted, cancelled, refunded, noShow | Yes |
| **Communications** | messageStatusEnum | draft, scheduled, sending, sent, cancelled, failed | Partial |
| **Communications** | announcementStatusEnum | draft, scheduled, sent, scheduledFailed, archived | Partial |
| **Documents** | documentStatusEnum | draft, published, archived | Minimal |
| **Comms** | chatRoomStatusEnum | active, archived | Yes |
| **Comms** | videoCallStatusEnum | starting, active, ended, cancelled | Yes |
| **Storage** | fileStatusEnum | uploading, processing, available, failed | Minimal |
| **Notifications** | notificationStatusEnum | queued, sent, delivered, read, failed, expired | Yes |
| **Invite** | inviteStatusEnum | pending, claimed, expired, revoked | Yes |
| **Credentials** | licenseStatusEnum | active, expired, suspended, revoked, pending | Minimal |
| **Credentials** | credentialStatusEnum | active, suspended, revoked, expired | Minimal |
| **Billing** | invoiceStatusEnum | draft, open, paid, void, uncollectible | Yes |
| **Billing** | paymentStatusEnum | pending, requires_capture, processing, succeeded, failed, canceled | Yes |
| **Transfers** | transferStatusEnum | requested, pendingSourceApproval, pendingTargetApproval, approved, denied, completed | Yes |
| **Training** | enrollmentStatusEnum | enrolled, completed, cancelled, noShow | Yes |
| **Email** | emailQueueStatusEnum | pending, processing, sent, failed, cancelled | Yes |
| **Audit** | auditRetentionStatusEnum | active, archived, pending-purge | Minimal |

**Finding:** Core business state machines (membership, dues, booking, elections, training, events) all have transition guards. Peripheral modules (documents, credentials, audit) have minimal guard logic — acceptable given lower mutation risk.

---

## 10. UI / Screens Summary

### Routes Per App

| App | Routes | Port | Purpose |
|-----|--------|------|---------|
| memberry | 66 | 3004 | Product app — membership, dues, events, training |
| account | 16 | 3002 | Auth, profile, settings, onboarding |
| admin | 11 | 3003 | Ops dashboard — associations, members, audit, flags |

### Admin App SDK Usage

| Pattern | Count |
|---------|-------|
| Raw `fetch()` calls | 7 |
| `@monobase/sdk-ts` imports | 0 |

**Finding:** Admin app uses raw fetch exclusively. Should migrate to SDK hooks for consistency and type safety. Cosmetic/consistency issue, not a security risk.

### Mock Data Contamination

Mock/placeholder references found in 25+ files across memberry and admin apps. Most are:
- Test utilities (`mock` in test file names)
- Component placeholder text (`placeholder` props on inputs)
- TODO comments for future features

**No production code relying on mock data detected.**

---

## 11. Test Coverage Summary

### Per-Category Breakdown

| Category | Total Items | Tested | Untested | Coverage | Assertion Quality |
|----------|-----------|--------|----------|----------|-------------------|
| Business rules | 40 | 34 | 6 (deferred) | 85% | 28 STRONG, 3 WEAK, 3 NONE (impl), 6 NONE (deferred) |
| Permissions (role × action) | ~60 | 55+ | ~5 | 92% | Mostly STRONG |
| API endpoints | 360 | ~300 | ~60 | 83% | Mix of STRONG (unit) and WEAK (contract shape) |
| State transitions | 25 machines | 20 | 5 | 80% | STRONG for core, WEAK for peripheral |
| Validation rules | ~100 | ~80 | ~20 | 80% | STRONG (Zod + TypeSpec validation) |
| UI components | ~50 | 44 tested | ~6 | 88% | WEAK (render tests, not behavior) |
| UI interactions | ~30 critical | ~25 | ~5 | 83% | STRONG (Playwright click-through) |
| Interaction states (9 per screen) | ~270 | ~100 | ~170 | 37% | STRONG (Wave 2: 60 tests across 10 screens) |
| Accessibility | ~50 elements | ~10 | ~40 | 20% | ADEQUATE (Wave 2: axe-core baseline for 10 screens) |

### Per-Module Test Coverage

| Module | Unit Tests | E2E Tests | Contract Tests | Total | Rating |
|--------|-----------|-----------|---------------|-------|--------|
| association:member | 38 | 15+ | 8 | 61 | Good |
| person | 29 | 5+ | 2 | 36 | Good |
| communication | 32 | 3+ | 2 | 37 | Good |
| platformadmin | 24 | 2+ | 1 | 27 | Good |
| booking | 23 | 2+ | 2 | 27 | Good |
| billing | 20 | 2+ | 0 | 22 | Adequate |
| membership | 21 | 3+ | 2 | 26 | Good |
| email | 17 | 0 | 0 | 17 | Adequate |
| documents | 17 | 0 | 1 | 18 | Adequate |
| training | 16 | 3+ | 3 | 22 | Good |
| events | 13 | 5+ | 3 | 21 | Good |
| elections | 10 | 2+ | 2 | 14 | Good |
| dues | 7 | 3+ | 2 | 12 | Adequate |
| notifs | 6 | 0 | 2 | 8 | Low |
| reviews | 5 | 0 | 1 | 6 | Low |
| invite | 4 | 0 | 0 | 4 | Low |
| certificates | 4 | 2+ | 0 | 6 | Low |
| audit | 3 | 1+ | 0 | 4 | Low |
| comms | 3 | 0 | 1 | 4 | Low |
| storage | 2 | 0 | 1 | 3 | Low |
| association:operations | 10 | 5+ | 3 | 18 | Good (Wave 2: +8 test files, 169 tests) |

### BR-Test Traceability (Key Rules)

| BR | Rule | Test File | Quality |
|----|------|-----------|---------|
| BR-03 | Membership transitions | settle-payment.test.ts | STRONG |
| BR-05 | Fund allocation | fund-math.test.ts | STRONG (12 assertions) |
| BR-07 | Dues expiry extension | expiry-extension.test.ts | STRONG |
| BR-09 | Officer role assignment | createOfficerTerm tests | STRONG |
| BR-10 | Impersonation | startImpersonation tests | STRONG |
| BR-12 | Credit carry-over | credit-carryover E2E | STRONG |
| BR-24 | Invitation expiry | validateInvite tests | STRONG |
| BR-27 | Event registration limits | event-capacity E2E | STRONG |
| BR-32 | Financial retention | requestAccountDeletion tests | STRONG |
| BR-15 | Training vs event | (implicit in separate modules) | WEAK |
| BR-18 | QR code auth | (no dedicated test) | WEAK |
| BR-28 | Comm dedup | (no dedicated test) | WEAK |
| BR-35-40 | Deferred rules | — | NONE |

---

## 12. Repository Guardrails Review

| File | Exists? | Accurate? | Gaps | Action |
|------|---------|-----------|------|--------|
| README.md | Yes | Yes | None | Maintain |
| CONTRIBUTING.md | Yes | Yes | None | Maintain |
| CLAUDE.md | Yes | Yes — comprehensive | None | Maintain |
| VERTICAL_TDD.md | Yes | Yes | None | Maintain |
| docs/ARCHITECTURE.md | Yes | Yes | None | Maintain |
| docs/DOMAIN_GLOSSARY.md | Yes | Yes — DDD classification added | None | ✅ Resolved |
| docs/MASTER_PRD.md | Yes | Yes | None | Maintain |
| docs/MODULE_MAP.md | Yes | Mostly | Update handler counts | P3 |
| .planning/ | Yes | Active | STATE.md slightly stale (says Phase 24) | P3 |
| .claude/skills/ | Yes | 17 skills active | None | Maintain |
| .github/workflows/ | Yes | contract.yml active | None | Maintain |

---

## 13. PRD / Spec Coverage Review

| Artifact | Exists? | Matches Code? | Quality | Action |
|----------|---------|--------------|---------|--------|
| MASTER_PRD.md | Yes | Yes | Good | Maintain |
| DOMAIN_GLOSSARY.md | Yes | Yes | Good — DDD classification added (Wave 2) | Maintain |
| MODULE_MAP.md | Yes | Mostly | Stale handler counts | Update counts |
| ROLE_PERMISSION_MATRIX.md | Yes | Yes | Good — 195 rows, role×module×action (Wave 2) | Maintain |
| Business rules doc | Yes (docs/ver-3/business/) | Yes | Excellent — 40 rules | Maintain |
| QA-COVERAGE-MATRIX.md | Yes | Mostly | Good | Update |

---

## 14. Standards Gap Matrix

| Gap ID | Description | Priority | Affected Modules | Recommended Fix |
|--------|------------|----------|-----------------|-----------------|
| GAP-01 | 7 hand-wired routes in app.ts not covered by TypeSpec | P2 | email, training (providers) | Add TypeSpec definitions |
| GAP-02 | Admin app uses raw fetch instead of SDK | P2 | admin | Migrate to @monobase/sdk-ts |
| GAP-03 | No formal bounded context boundaries | P3 | All (cross-module imports) | Introduce module interface layer |
| GAP-04 | ~~Pagination not applied to all list endpoints~~ | ✅ CLOSED | Various | False positive — all 12 TypeSpec modules uniformly use `...PaginationQuery` spread pattern |
| GAP-05 | 6 business rules deferred (BR-35 to BR-40) | P3 | Various | Implement in v1.3.0 |
| GAP-06 | orgId vs organizationId inconsistency | P3 | TypeSpec modules | Standardize to organizationId |
| GAP-07 | ~~No systematic accessibility testing~~ | ✅ CLOSED | Frontend apps | @axe-core/playwright + 10 baseline scans (Wave 2) |
| GAP-08 | ~~Interaction state coverage at 15%~~ | ✅ CLOSED | Frontend apps | 60 tests across 10 screens, coverage now 37% (Wave 2) |
| GAP-09 | 3 communication modules overlap | P2 | Backend | Consolidate (deferred from v1.2.0) |
| GAP-10 | ~~association:operations has only 2 unit tests (3% ratio)~~ | ✅ CLOSED | association:operations | 10 test files, 169 tests, all 54 handlers covered (Wave 2) |
| GAP-11 | storage module has only 2 tests (25% ratio) | P2 | storage | Add upload/download tests |
| GAP-12 | ~~ROLE_PERMISSION_MATRIX.md missing~~ | ✅ CLOSED | docs | Created with 195 rows (Wave 1) |
| GAP-13 | STATE.md stale (shows Phase 24) | P3 | .planning | Update STATE.md |

---

## 15. Inconsistency Report

### Minor (Consistency)

| ID | Type | Description | Files | Impact |
|----|------|-------------|-------|--------|
| INC-01 | Naming | `orgId` vs `organizationId` in TypeSpec (42 vs 47 occurrences) | specs/api/src/modules/*.tsp | Low |
| INC-02 | Architecture | 3 communication modules (comms, communication, communications) | services/api-ts/src/handlers/ | Medium |
| INC-03 | SDK | Admin app uses raw fetch, memberry uses SDK | apps/admin/src/ | Low |
| INC-04 | ~~Testing~~ | ~~association:operations has 59 handlers but only 2 tests~~ | ✅ RESOLVED (Wave 2: 10 test files, 169 tests) | — |

**No Critical or Major inconsistencies found.** All prior critical findings (P0/P1) from the May 13 audit have been resolved.

---

## 16. Risk Assessment

### P0 Risks (Fix Immediately)
None. All P0 issues from prior audit resolved.

### P1 Risks (Fix Before Major New Work)
None. All P1 issues resolved in v1.1.0 and v1.2.0 milestones.

### P2 Risks (Fix When Touching Module)
1. **GAP-09:** Communication module naming clarification
2. ~~**GAP-04:** Pagination applied inconsistently~~ — ✅ CLOSED (false positive)
3. **GAP-11:** storage module test gap (2 tests)

### P3 Risks (Improve Later)
1. **GAP-03:** Bounded context formalization
2. **GAP-06:** orgId naming standardization
3. **GAP-05:** Deferred business rules (BR-35 to BR-40)

### Resolved Since Last Audit (Wave 1+2)
- ~~**GAP-10:** association:operations test gap~~ — 10 test files, 169 tests (Wave 2)
- ~~**GAP-07/08:** Frontend accessibility and interaction state testing~~ — 60 tests + 10 a11y baselines (Wave 2)
- ~~**GAP-12:** Permission matrix documentation~~ — ROLE_PERMISSION_MATRIX.md created (Wave 1)

---

## 17. Stabilization Plan

### Fix Immediately
Nothing — no P0 or P1 issues.

### Fix Before Major New Work (v1.3.0 planning)
1. Update STATE.md to reflect v1.2.0 completion
2. ~~Backfill association:operations tests~~ ✅ Done (Wave 2)
3. Plan communication module consolidation

### Fix When Touching Module
1. Add TypeSpec definitions when modifying hand-wired routes
2. Apply pagination when adding new list endpoints
3. Add interaction state tests when modifying frontend screens
4. Migrate admin app from fetch to SDK when adding admin features

---

## 18. Standards Adoption Plan

### Phase 1: Add Guardrails ✅ COMPLETE
- README.md, CONTRIBUTING.md, CLAUDE.md, VERTICAL_TDD.md all exist and are accurate
- .claude/skills/ with 17 development skills
- .github/workflows/ with contract testing CI

### Phase 2: Document Current Reality ✅ COMPLETE
- MASTER_PRD.md, DOMAIN_GLOSSARY.md, MODULE_MAP.md exist
- ROLE_PERMISSION_MATRIX.md created (Wave 1 — 195 rows)
- DDD classification added to DOMAIN_GLOSSARY.md (Wave 1)

### Phase 3: Stabilize Risky Areas ✅ COMPLETE
- All P0/P1 security issues resolved
- RBAC fully wired
- State machine guards in place
- Cascade deletes fixed
- 2FA enforcement for privileged roles

### Phase 4: Adopt Vertical Slice TDD ✅ IN PRACTICE
- VERTICAL_TDD.md documents the protocol
- Phases 11-25 followed vertical TDD approach
- 305 backend tests + 89 E2E tests + 60 interaction state tests demonstrate adoption

### Phase 5: Migrate Existing Code Gradually 🔄 ONGOING
- 14/21 modules have TypeSpec (67%)
- 7 modules still hand-wired
- Migrate when touched in v1.3.0 work

---

## 19. Recommended First 3 Vertical Slices to Standardize

| Rank | Slice | Module | Why This Slice | Risk | Expected Work |
|------|-------|--------|---------------|------|---------------|
| 1 | Communication consolidation | comms + communication + communications | 3 overlapping modules cause confusion; consolidation reduces surface area | Medium | 2-3 days |
| 2 | ~~association:operations test backfill~~ | ~~association:operations~~ | ✅ DONE (Wave 2) — 10 test files, 169 tests | — | — |
| 3 | Admin app SDK migration | admin | Only app using raw fetch; SDK migration ensures type safety | Low | 1 day |

---

## 20. Health Score

| # | Dimension | Score (0-10) | Evidence | Δ |
|---|-----------|-------------|----------|---|
| 1 | Terminology consistency | 7 | orgId/organizationId split (42 vs 47); dues_config naming; otherwise consistent | — |
| 2 | Permission coverage | 9 | Global auth + handler guards + 2FA + platform admin isolation; all mutations protected | — |
| 3 | Business rule clarity | 9 | 40 rules documented with phases, modules, edge cases; 85% implemented | — |
| 4 | API consistency | 9 | 360 endpoints from TypeSpec; consistent error/response patterns; 7 hand-wired routes | — |
| 5 | State machine safety | 9 | 25 state machines; core ones have guards; peripheral minimal but acceptable | — |
| 6 | Error handling uniformity | 8 | HTTPException used uniformly; consistent shapes; some modules lack error tests | — |
| 7 | Backend test coverage | 9 | 305 test files across 21 modules; association:operations now 10 tests (was 2); key BRs STRONG | — |
| 8 | Frontend test coverage | 8 | 44 component tests + 89 E2E + 60 interaction state tests + 10 a11y baselines; state coverage 37% (was 15%) | **+2** |
| 9 | PRD/spec coverage | 9 | PRD, glossary, module map, ROLE_PERMISSION_MATRIX.md (195 rows), DDD classification all present | **+1** |
| 10 | UI prototype readiness | 8 | 93 routes across 3 apps; no mock contamination; admin SDK gap | — |
| 11 | Architecture alignment | 9 | Spec-first workflow established; TDD adopted; CI with contract tests | — |
| 12 | Domain model clarity | 8 | DDD classification table + 8 bounded contexts + ACL recommendations in glossary; tight coupling remains | **+1** |

**Overall Health: 8.5/10** (102/120)

**Arithmetic correction:** Previous audit stated 8.7/10 (104/120), but dimension scores summed to 98/120 = 8.17. This refresh corrects the arithmetic: 102/120 = 8.50. The improvement is real (+4 points in dimension sum), but the baseline was lower than reported.

---

## 21. Final Recommendations

### Do Now
1. Update STATE.md to reflect v1.2.0 completion

### Do Next
2. Consolidate 3 communication modules before v1.3.0
3. Migrate admin app from fetch to SDK
4. Backfill storage module tests (2 tests, 25% ratio)

### Do Later
5. Standardize orgId → organizationId
6. Formalize bounded context boundaries
7. Implement deferred BRs (BR-35 through BR-40)

### Already Done (Wave 1+2)
- ~~Backfill association:operations unit tests~~ ✅ 169 tests
- ~~Add ROLE_PERMISSION_MATRIX.md~~ ✅ 195 rows
- ~~Add DDD classification to DOMAIN_GLOSSARY.md~~ ✅ 5 sections
- ~~Add accessibility testing framework~~ ✅ @axe-core/playwright + 10 baselines
- ~~Add interaction state tests~~ ✅ 60 tests across 10 screens

### Avoid
- Big-bang communication module rewrite (consolidate incrementally)
- Premature anti-corruption layers (wait for pain to justify complexity)
- Rewriting hand-wired routes that work correctly (add TypeSpec when modifying)

---

## Appendix A: Changes Since Pre-Wave 2 Audit (2026-05-14)

### Wave 1 (Quick Tasks)
- **QT-1:** Created `docs/ROLE_PERMISSION_MATRIX.md` — 195 rows, role×module×action matrix
- **QT-2:** Added DDD classification to `docs/DOMAIN_GLOSSARY.md` — 17 entities classified, 8 bounded contexts, ACL recommendations

### Wave 2 (Test Coverage)
- **Phase 26:** 10 interaction state + a11y test files in `apps/memberry/tests/e2e/states/` — 60 tests (50 interaction state + 10 a11y baselines). Installed @axe-core/playwright. Created `helpers/a11y.ts`.
- **Phase 27:** 8 test files in `services/api-ts/src/handlers/association:operations/` — 169 tests (244 expect() calls). All 54 handlers now covered. Files: training-lifecycle, training-enrollment, courses, course-enrollment, check-in, quiz, waitlist, custom-events.

### Metric Delta

| Metric | Pre-Wave 2 | Post-Wave 2 | Delta |
|--------|-----------|-------------|-------|
| Backend test files | 297 | 305 | +8 |
| Backend test expect() calls | — | +244 | +244 |
| E2E test files (memberry) | ~70 | 80 | +10 |
| Interaction state tests | 0 | 60 | +60 |
| A11y baseline tests | 0 | 10 | +10 |
| association:operations tests | 2 | 10 | +8 |
| ROLE_PERMISSION_MATRIX.md | missing | 195 rows | new |
| DOMAIN_GLOSSARY DDD sections | 0 | 5 | +5 |
| Health score (corrected) | 8.2/10 (98/120) | 8.5/10 (102/120) | +0.3 |

### Score Arithmetic Correction
Previous audit stated 8.7/10 (104/120). Actual dimension sum was 98/120 = 8.17. The discrepancy of 6 points was an arithmetic error in the original audit. This refresh uses verified sum: 102/120 = 8.50.

## Appendix B: Changes Since May 13 Audit

### What Changed (v1.2.0 Milestone)
- **v1.2.0 Milestone:** 31/31 requirements complete (Phases 18-25)
- **Phase 18:** Dues invoice security fix — org-scoped RBAC
- **Phase 19:** Account deletion + data export (PH DPA compliance)
- **Phase 20:** Payment flow — offline payment, optimistic locking
- **Phase 21:** Officer daily ops — roster, bulk approvals
- **Phase 22:** PRC CPD compliance — accreditation, compliance summary
- **Phase 23:** Member departure + deceased — lifecycle termination
- **Phase 24:** Quality gap closure — roster fix, audit filter
- **Phase 25:** Email/notif guards + handler tests — ~120 new tests

### Previous Audit Corrections Preserved
These findings from May 13 were verified as incorrect and are NOT re-reported:
- "36 unprotected mutation routes" — FALSE (global auth middleware protects all)
- "11 tables missing organizationId" — MOSTLY FALSE (only invitation_token)
- "No pagination standard" — FALSE (pagination.tsp exists)
- "Association:Member has 0 contract tests" — FALSE (5 contract test files exist)
- "Duplicate dues_config export" — FALSE (different table names)

---

**What's Next:**
- `/oli-vertical-slice-plan` — Plan v1.3.0 implementation sequencing
- Communication module consolidation — top remaining gap
- `/oli-confidence-stack` — Score test confidence across coverage layers
