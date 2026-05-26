# 00 — Brownfield Baseline Audit

**Date:** 2026-05-26
**Scope:** Full codebase (memberry app, admin app, api-ts service, specs, SDK, tests)
**Mode:** Read-only audit. No code modifications.

---

## 1. Project Structure Summary

| Component | Technology | Path |
|-----------|-----------|------|
| Package Manager | Bun | `bun.lock` |
| Frontend Framework | React 19 + TanStack Router | `apps/memberry/`, `apps/admin/` |
| Backend Framework | Hono + Bun | `services/api-ts/` |
| API Specification | TypeSpec → OpenAPI | `specs/api/` |
| ORM | Drizzle ORM (PostgreSQL) | `services/api-ts/src/handlers/*/repos/*.schema.ts` |
| Client SDK | Auto-generated TanStack Query hooks | `packages/sdk-ts/` |
| UI Components | shadcn/ui (Radix primitives) | `apps/memberry/src/components/ui/` |
| Unit Tests (API) | Bun test (Vitest compat) | `services/api-ts/src/**/*.test.ts` |
| Unit Tests (Frontend) | Vitest + happy-dom | `apps/memberry/src/**/*.test.ts` |
| E2E Tests | Playwright | `apps/memberry/tests/e2e/`, `apps/admin/tests/e2e/` |
| Contract Tests | Hurl | `specs/api/tests/contract/` |
| Auth | Better-Auth (integrated) | `services/api-ts/src/core/auth.ts` |

### Ports
- API: 7213
- Memberry app: 3004
- Admin app: 3003

---

## 2. Module Map

### Backend Modules (25 handler directories)

| # | Module | Handler Count | TypeSpec? | Schema Files | Jobs? | Path |
|---|--------|--------------|-----------|-------------|-------|------|
| 1 | association:member | 189 | Yes | 13 | Yes | `handlers/association:member/` |
| 2 | association:operations | 68 | Yes | 4 | No | `handlers/association:operations/` |
| 3 | communication | 44 | Yes | 3 | Yes | `handlers/communication/` |
| 4 | person | 28 | Yes | 3 | Yes | `handlers/person/` |
| 5 | platformadmin | 26 | Yes | 1 | No | `handlers/platformadmin/` |
| 6 | booking | 19 | Yes | 1 | Yes | `handlers/booking/` |
| 7 | billing | 16 | Yes | 1 | No | `handlers/billing/` |
| 8 | dues | 15 | Hand-wired | 1 | Yes | `handlers/dues/` |
| 9 | documents | 15 | Yes | 1 | No | `handlers/documents/` |
| 10 | membership | 12 | Hand-wired | 1 | Yes | `handlers/membership/` |
| 11 | events | 11 | Yes | 1 | No | `handlers/events/` |
| 12 | comms | 11 | Yes | 1 | No | `handlers/comms/` |
| 13 | training | 10 | Hand-wired | 1 | No | `handlers/training/` |
| 14 | email | 9 | Yes | 1 | Yes | `handlers/email/` |
| 15 | communications | 8 | Hand-wired | 0 | No | `handlers/communications/` |
| 16 | elections | 6 | Hand-wired | 1 | No | `handlers/elections/` |
| 17 | storage | 6 | Yes | 1 | No | `handlers/storage/` |
| 18 | notifs | 5 | Mixed | 1 | Yes | `handlers/notifs/` |
| 19 | reviews | 4 | Yes | 1 | No | `handlers/reviews/` |
| 20 | invite | 3 | Yes | 0 | No | `handlers/invite/` |
| 21 | certificates | 3 | Yes | 1 | No | `handlers/certificates/` |
| 22 | audit | 1 | Yes | 1 | Yes | `handlers/audit/` |
| 23 | surveys | ~5 | Yes | 1 | Yes | `handlers/surveys/` |
| 24 | advertising | ~3 | No | 1 | No | `handlers/advertising/` |
| 25 | marketplace | ~3 | No | 1 | No | `handlers/marketplace/` |

**TypeSpec coverage:** ~58% of modules (15/25 have TypeSpec definitions)

### Frontend Modules (apps/memberry)

| Module | Route Prefix | Route Count | Feature Path |
|--------|-------------|-------------|-------------|
| Dashboard | `/dashboard` | 1 | `features/dashboard/` |
| Profile/Settings | `/my/profile`, `/my/settings` | 2 | `features/person/` |
| Billing/Payments | `/my/billing`, `/my/payments` | 2 | `features/billing/` |
| Bookings | `/my/bookings/*` | 4 | `features/booking/` |
| Calendar | `/my/calendar` | 1 | `features/booking/` |
| Certificates | `/my/certificates/*` | 2 | `features/certificates/` |
| Credits/CPD | `/my/credits/*`, `/org/*/my-cpd` | 3 | `features/credits/` |
| Training | `/my/training`, `/org/*/training/*` | 3 | `features/training/` |
| Events | `/my/events`, `/discover/events` | 2 | `features/events/` |
| Documents | `/org/*/documents/*` | 2 | `features/documents/` |
| Elections | `/org/*/elections/*` | 2 | `features/elections/` |
| Announcements | `/org/*/announcements/*` | 2 | `features/communications/` |
| Messages/DM | `/org/*/messages/*` | 2 | `features/comms/` |
| Directory | `/org/*/directory/*` | 2 | `features/membership/` |
| Governance | `/org/*/governance` | 1 | `features/governance/` |
| Notifications | `/my/notifications`, `/org/*/my-notifications` | 2 | `features/notifications/` |
| ID Card | `/my/id-card` | 1 | `features/id-card/` |
| Data Export | `/my/data-export` | 1 | `features/data-export/` |
| Surveys | `/my/surveys/*` | 2 | `features/surveys/` |
| Organizations | `/my/organizations` | 1 | `features/admin/` |
| Officer (all) | `/org/*/officer/*` | 36 | `features/*/` (officer views) |

### Admin App Modules

| Module | Route | Purpose |
|--------|-------|---------|
| Dashboard | `/` | Platform stats |
| Associations | `/associations/*` | National body management |
| Organizations | `/organizations/*` | Org management |
| Operators | `/operators` | Platform operator management |
| Members | `/members/*` | Cross-org member view |
| Training | `/training` | Training programs |
| Committees | `/committees` | Committee management |
| Events | `/events` | Event oversight |
| Verifications | `/verifications` | Verification queue |
| National Dashboard | `/national-dashboard` | Analytics |
| Compliance | `/compliance` | Compliance monitoring |
| Audit | `/audit` | Audit logs |
| Surveys | `/surveys` | Survey management |
| Feature Flags | `/feature-flags` | Feature toggles |
| Impersonate | `/impersonate` | User impersonation |
| Communications | `/communications/*` | Comms management |

---

## 3. Existing Specs/Docs Found

| Category | Document | Path |
|----------|----------|------|
| API Contract | CONTRACT.md | `specs/api/CONTRACT.md` |
| API Implementation | IMPLEMENTING.md | `specs/api/IMPLEMENTING.md` |
| Domain Model | DOMAIN_MODEL.md | `docs/product/DOMAIN_MODEL.md` |
| Domain Glossary | DOMAIN_GLOSSARY.md | `docs/product/DOMAIN_GLOSSARY.md` |
| Workflow Map | WORKFLOW_MAP.md | `docs/product/WORKFLOW_MAP.md` |
| Module Map | MODULE_MAP.md | `docs/product/MODULE_MAP.md` |
| UI Blueprint | UI_BLUEPRINT.md | `docs/product/UI_BLUEPRINT.md` |
| Event Contracts | EVENT_CONTRACTS.md | `docs/product/EVENT_CONTRACTS.md` |
| Seed Manifest | SEED_MANIFEST.md | `docs/product/SEED_MANIFEST.md` |
| Architecture | ARCHITECTURE.md | `docs/ARCHITECTURE.md` |
| Roadmap | ROADMAP.md | `ROADMAP.md` |
| Contributing | CONTRIBUTING.md | `CONTRIBUTING.md` |
| TDD Protocol | VERTICAL_TDD.md | `VERTICAL_TDD.md` |
| Module Specs (19) | m01–m19 specs | `docs/product/modules/` |
| Prior Audits (25+) | Various | `docs/audits/` |
| Planning | ROADMAP, REQUIREMENTS, etc. | `.planning/` |
| Trace Report | TRACE_REPORT.md | `docs/trace/TRACE_REPORT.md` |

---

## 4. Role Inventory

### Memberry App Roles

| Role | Scope | Source | Frontend Enforcement | Backend Enforcement |
|------|-------|--------|---------------------|---------------------|
| Authenticated User | Global | Better-Auth session | `requireAuth` guard in `_authenticated.tsx` | Auth middleware |
| Guest | Global | No session | `requireGuest` guard | N/A |
| Member | Per-org | Org membership | Layout-level (implicit) | Org-auth middleware |
| Officer | Per-org | Officer role query | `requireOrgOfficer` guard | `requireOrgRole()` |
| President | Per-org | Position title | `POSITION_NAV_CONFIG` sidebar filter | Role hierarchy check |
| Vice President | Per-org | Position title | `POSITION_NAV_CONFIG` sidebar filter | Role hierarchy check |
| Secretary | Per-org | Position title | `POSITION_NAV_CONFIG` sidebar filter | Role hierarchy check |
| Treasurer | Per-org | Position title | `POSITION_NAV_CONFIG` sidebar filter | Role hierarchy check |
| Board Member | Per-org | Position title | `POSITION_NAV_CONFIG` sidebar filter | Role hierarchy check |
| Staff | Per-org | Position title | `POSITION_NAV_CONFIG` sidebar filter | Role hierarchy check |

**Backend role hierarchy:** president > vice-president > secretary > treasurer > board-member > officer > staff > member

### Admin App Roles

| Role | Scope | Frontend Enforcement | Backend Enforcement |
|------|-------|---------------------|---------------------|
| super | Global | `RequireRole` + `ROUTE_ROLES` matrix | Platform admin middleware |
| support | Global | `RequireRole` + `ROUTE_ROLES` matrix | Platform admin middleware |
| analyst | Global | `RequireRole` + `ROUTE_ROLES` matrix | Platform admin middleware |

### Backend System Roles

| Role | Context | Location |
|------|---------|----------|
| admin | System | `middleware/auth.ts` |
| support | System | `middleware/auth.ts` |
| user | System | `middleware/auth.ts` |
| client | Context | `middleware/auth.ts` |
| host | Context | `middleware/auth.ts` |

### Role Gaps & Concerns

| Finding | Severity | Notes |
|---------|----------|-------|
| Officer sidebar uses position title strings, not enum | P2 | `POSITION_NAV_CONFIG[position.title]` — fragile, depends on exact title match |
| No explicit per-route member role guard | P2 | Member routes rely on auth-only, not membership status check `[NEEDS PRODUCT DECISION]` |
| Impersonation read-only enforcement | P1 | `[NEEDS MANUAL CONFIRMATION]` — verify impersonation guard blocks writes |
| Officer role cached 5min | P2 | Stale role data possible if role changed mid-session |

---

## 5. Frontend Surface Summary

### Route Counts

| App | Auth Routes | Member Routes | Officer Routes | Admin Routes | Public Routes | Total |
|-----|------------|---------------|----------------|-------------|--------------|-------|
| Memberry | 2 | 43 | 36 | 0 | 1 | 82 |
| Admin | 0 | 0 | 0 | 23 | 0 | 23 |
| **Total** | **2** | **43** | **36** | **23** | **1** | **105** |

### Layouts

| Layout | App | File | Responsive? |
|--------|-----|------|------------|
| Member Sidebar | Memberry | `components/layout/member-sidebar.tsx` | Yes (hidden mobile) |
| Member Bottom Nav | Memberry | `components/layout/member-bottom-nav.tsx` | Mobile only |
| Member Header | Memberry | `components/layout/member-header.tsx` | Yes |
| Officer Sidebar | Memberry | `components/layout/officer-sidebar.tsx` | Yes |
| Officer Mobile Nav | Memberry | `components/layout/officer-mobile-nav.tsx` | Mobile only |
| Org Icon Rail | Memberry | `components/layout/org-icon-rail.tsx` | Yes |
| Org Picker Sheet | Memberry | `components/layout/org-picker-sheet.tsx` | Modal |
| Admin Sidebar | Admin | `routes/__root.tsx` (inline) | Yes |

### UI Components

| Type | Count | Base Pattern |
|------|-------|-------------|
| Forms | 12 | react-hook-form + FormField pattern |
| Tables/DataGrids | 4 | @tanstack/react-table via DataTable |
| Modals/Dialogs | 9 | Radix Dialog/Sheet primitives |
| Navigation | 7 | Sidebar + bottom nav + org rail |

---

## 6. Backend/API Surface Summary

### Endpoint Inventory

| Source | Count | Notes |
|--------|-------|-------|
| TypeSpec → generated routes | ~2,945 lines | Auto-generated from 19 .tsp files |
| Hand-wired routes (app.ts) | 45 | Public, admin, org-scoped, special auth |
| **Total route registrations** | **~300+** | Estimate based on generated + hand-wired |

### Middleware Stack (12 layers)

| Middleware | File | Purpose |
|-----------|------|---------|
| Auth | `middleware/auth.ts` | Session validation, role check |
| Org Context | `middleware/org-context.ts` | Org scoping |
| Platform Admin | `middleware/platform-admin-auth.ts` | Admin-only routes |
| Impersonation Guard | `middleware/impersonation-guard.ts` | Read-only enforcement |
| Audit | `middleware/audit.ts` | Access logging |
| Validation | `middleware/validation.ts` | Request validation |
| Rate Limit | `middleware/rate-limit.ts` | Rate limiting |
| Request | `middleware/request.ts` | Request context |
| Security | `middleware/security.ts` | Security headers |
| Dependency | `middleware/dependency.ts` | DI |
| Expand | `middleware/expand.ts` | Response expansion |
| Officer Auth | `middleware/officer-auth.ts` | Officer-specific auth |

### Database Schema (44 files)

| Module | Schema Count | Key Entities |
|--------|-------------|-------------|
| association:member | 13 | Membership, dues, credentials, directory, governance, dunning, assessments |
| association:operations | 4 | Committee, training, events |
| communication | 3 | Announcements, feed-posts, surveys |
| person | 3 | Profile, preferences, privacy-settings |
| Other modules | 21 | 1 each (billing, booking, certificates, etc.) |

### Error Handling

**Base class:** `AppError` in `services/api-ts/src/core/errors.ts`

**Error types:** UnauthorizedError (401), ForbiddenError (403), ValidationError (400), BusinessLogicError (422), ConflictError (409), NotFoundError (404), RateLimitError (429), HipaaComplianceError, TimeoutError, ExternalServiceError

### Background Jobs (11 modules)

| Module | Jobs |
|--------|------|
| dues | autoInvoiceGenerator, reminderProcessor, webhookRetryProcessor |
| booking | confirmationTimer, slotCleanup, slotGenerator |
| association:member | complianceThreshold, creditIssue, directoryAutoPopulate, reminderProcessor, webhookRetryProcessor |
| email | processor |
| membership | graceToLapsed |
| person | deletionProcessor |
| communication | announcementSend |

---

## 7. Test Structure Summary

### Test Inventory

| Category | Files | Test Cases | Framework | Path |
|----------|-------|-----------|-----------|------|
| API Unit Tests | 500 | 6,629 | Bun test | `services/api-ts/src/**/*.test.ts` |
| Frontend Unit Tests | 97 | 764 | Vitest + happy-dom | `apps/memberry/src/**/*.test.ts` |
| E2E Tests (Memberry) | 116 | 673 | Playwright | `apps/memberry/tests/e2e/` |
| E2E Tests (Admin) | 8 | 38 | Playwright | `apps/admin/tests/e2e/` |
| Contract Tests | 97 | N/A | Hurl | `specs/api/tests/contract/` |
| **Total** | **721+97** | **8,104+** | | |

### Test Quality Indicators

| Indicator | Value | Assessment |
|-----------|-------|-----------|
| Skipped tests (test.skip) | 14 | Blocked by seed data / feature gates |
| Disabled suites (describe.skip) | 8 | Blocked by environment |
| TODO tests (test.todo) | 21 | Unimplemented specifications |
| Stub tests (excluded) | 12 files | Future wave features |
| Coverage threshold | 29% | Below industry standard (80%) |
| Playwright workers | 1 (sequential) | Limits CI speed |
| Playwright retries | 1 (CI only) | Adequate |

### Top Test Coverage by Module

| Module | API Tests | E2E Tests | Frontend Unit | Contract | Overall |
|--------|----------|-----------|--------------|----------|---------|
| Auth | Yes | 14+ cases | No | Yes | STRONG |
| Person/Profile | Yes | 5 cases | 30 schema tests | Yes | STRONG |
| Membership | Yes | Yes | 18 status tests | Yes | STRONG |
| Dues/Billing | Yes | Limited | 15 billing tests | Yes | MODERATE |
| Events | 83 tests | 4 cases | 15 state tests | Yes | STRONG |
| Training | Yes | 11 cases | No | Yes | MODERATE |
| Elections | Yes | Limited | No | Yes | MODERATE |
| Communications | Yes | Limited | No | Yes | WEAK |
| Documents | Yes | 4 cases | No | Yes | MODERATE |
| Comms (WS) | Yes | No | No | Yes | WEAK |
| Admin panel | No | 38 cases | No | No | WEAK |

---

## 8. Key Risks

| # | Risk | Severity | Evidence | Impact |
|---|------|----------|----------|--------|
| R1 | `association:member` mega-module (189 files) | P2 | Split plan exists at `.planning/deferred/14-mega-module-split/` | Maintenance burden, test isolation |
| R2 | 45 hand-wired routes outside TypeSpec | P1 | `services/api-ts/src/app.ts` | No generated types/validators for these routes |
| R3 | Frontend coverage at 29% threshold | P1 | `apps/memberry/vitest.config.ts` | Low confidence in frontend behavior |
| R4 | 43 skipped/disabled tests | P2 | Grep for `skip`, `todo` | Silent regression risk |
| R5 | Officer role relies on position title strings | P2 | `POSITION_NAV_CONFIG` in officer-sidebar.tsx | Fragile, breaks on title rename |
| R6 | No explicit membership-status check on member routes | P1 | `_authenticated.tsx` only checks auth, not membership | Expired/lapsed members may access active-only features `[NEEDS PRODUCT DECISION]` |
| R7 | Impersonation write-safety unverified | P1 | `middleware/impersonation-guard.ts` | `[NEEDS MANUAL CONFIRMATION]` |
| R8 | 12 stub E2E test files excluded from suite | P2 | `stubs/` directory in E2E tests | Future features untested |
| R9 | Communications module split (comms vs communication vs communications) | P2 | 3 separate handler dirs | Naming confusion, unclear boundaries |
| R10 | Admin app has minimal test coverage | P1 | Only 8 E2E files, 38 cases, no unit tests | Admin actions under-tested |

---

## 9. Recommended Next Audit Prompt

**Next:** `02-role-permission-map-audit.md`

Rationale: Role system is complex (per-org officer roles + admin roles + position-based nav filtering). R5, R6, R7 need deep role-permission investigation before route/journey audits.

---

## Gate Evaluation: Audit 01

| Criterion | Status |
|-----------|--------|
| Project structure documented | PASS |
| Module map with paths | PASS |
| Existing docs/specs cataloged | PASS |
| Role inventory extracted | PASS |
| Frontend surface mapped | PASS |
| Backend surface mapped | PASS |
| Test structure summarized | PASS |
| Key risks identified with severity | PASS |
| Next audit recommended | PASS |

**Gate Result: PASS**

---

## Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `docs/audits/mapping-audit/00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | PENDING | — | — |
| 03 — Route Navigation | PENDING | — | — |
| 04 — Frontend Interaction Integrity | PENDING | — | — |
| 05 — Form/Modal/Table Action | PENDING | — | — |
| 06 — Backend API Contract Alignment | PENDING | — | — |
| 07 — Role-Based Journey Map | PENDING | — | — |
| 08 — Test Confidence Gap | PENDING | — | — |
| 09 — Prioritized Stabilization Plan | PENDING | — | — |
