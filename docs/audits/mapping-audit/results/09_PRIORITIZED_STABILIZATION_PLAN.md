# 09 — Prioritized Stabilization Plan

**Date**: 2026-05-26
**Scope**: All 12 modules (M1-M12)
**Total Findings**: P0=19, P1=73+, P2=50+, P3=10+

---

## Module Confidence Scores

| # | Module | Confidence | P0 | P1 | P2 |
|---|--------|-----------|----|----|-----|
| 1 | Auth/Session | 4.0/10 | 0 | — | — |
| 2 | Dues/Finances | 5.5/10 | 2 | — | — |
| 3 | Elections/Governance | 5.75/10 | 2 | — | — |
| 4 | Membership/Applications | 5.0/10 | 0 | — | — |
| 5 | Admin/Platform | 4.9/10 | 0 | 12 | — |
| 6 | Communications | 3.0/10 | 0 | 15 | — |
| 7 | Events/Booking | 5.8/10 | 0 | 18 | 9 |
| 8 | Training/Credits | **3.5/10** | **6** | 12 | 8 |
| 9 | Person/Profile | 5.5/10 | 2 | 4 | 6 |
| 10 | Docs/Certs/Storage | **4.0/10** | **4** | 8 | — |
| 11 | App Shell/Navigation | 6.5/10 | 0 | 0 | 8 |
| 12 | SDK/API Layer | 5.5/10 | 2 | 5 | — |

**Weighted Average Confidence: 4.9/10**

---

## P0 — Critical Findings (Fix Immediately)

### Wave 1: Auth Bypass / Data Exposure (BLOCK SHIP)

These are production-breaking security issues. Fix before any release.

| Priority | ID | Module | Finding | File | Fix Description |
|---------|-----|--------|---------|------|----------------|
| 1 | M8-P0-01 | Training | ALL ~32 `/association/training*` routes missing `authMiddleware()` — every training mutation callable unauthenticated | `generated/openapi/routes.ts` | Add auth to TypeSpec training model `@useAuth(BearerAuth)` and regenerate |
| 2 | M8-P0-02 | Training | Officer create/edit form calls non-existent endpoints (`/api/training/create/`, `/api/training/update/`) — feature is broken | `training-form.tsx` | Fix to use generated SDK hooks |
| 3 | M8-P0-03 | Training | `markComplete` no role check — any caller can award CPD credits to any person | `training/markComplete.ts` | Add officer/admin role check |
| 4 | M10-P0-01 | Docs | `getDocument` no org-scope check — cross-org IDOR, any authed user can fetch any org's document | `documents/getDocument.ts` | Add `if (doc.organizationId !== orgId) throw ForbiddenError` |
| 5 | M10-P0-02 | Docs | `getDocumentAccessLog` no officer restriction — any member reads compliance audit trail | `documents/getDocumentAccessLog.ts` | Add `requirePosition()` check |
| 6 | M10-P0-03 | Storage | `completeFileUpload` no ownership check — any user can mark another's upload complete | `storage/completeFileUpload.ts` | Add ownership verification |
| 7 | M10-P0-04 | Docs | `searchDocuments` `accessLevel` caller-controlled — members request privileged docs via API | `documents/searchDocuments.ts` | Enforce max accessLevel based on role server-side |
| 8 | M9-P0-01 | Person | `GET /persons/me/credits` missing `authMiddleware` in routes.ts — defense-in-depth gap on PII-adjacent endpoint | `generated/openapi/routes.ts` | Add auth to TypeSpec and regenerate |
| 9 | M9-P0-02 | Person | `executeAccountDeletion` no auth check — [NEEDS MANUAL CONFIRMATION] if HTTP-exposed | `person/executeAccountDeletion.ts` | Confirm invocation path; add auth if HTTP-exposed |
| 10 | M12-P0-01 | SDK | `officerAuthMiddleware` has zero tests — 2FA, missing orgId, non-officer paths unverified | `core/officer-auth-middleware.ts` | Write comprehensive test suite |
| 11 | M12-P0-02 | SDK | 2 handlers return HTTP 200 with error body — SDK treats as success silently | Various handlers | Fix to use proper error status codes |
| 12 | M2-P0-01 | Dues | Special assessment routes (6) — any auth user can CRUD financial obligations, NO backend validation | Assessment handlers | Add officer role checks |
| 13 | M2-P0-02 | Dues | Special assessment apply — any auth user can apply charges to org | Assessment apply handler | Add officer role check |
| 14 | M3-P0-01 | Elections | `certifyElection` — any user can replace all org officers | `certifyElection.ts` | Add officer/admin role check |
| 15 | M3-P0-02 | Elections | `createElection` — any user can create elections | `createElection.ts` | Add officer role check |
| 16 | M3-P0-03 | Elections | `createElection` raw SQL with `JSON.stringify(body.positions)` — no input validation | `createElection.ts` | Use parameterized query |
| 17 | M8-P0-04 | Training | No E2E catches broken create flow — bug exists silently in production | E2E gap | Write E2E test |
| 18 | M8-P0-05 | Training | Accredited provider handlers have correct auth but no frontend page | Multiple handlers | Build frontend or document as admin-only |
| 19 | M8-P0-06 | Training | Training type values mismatch between form and domain spec | `training-form.tsx` | Align enum values |

---

## Stabilization Slices (Execution Order)

### Slice 1: Auth Hardening (P0 — Estimated: 15 fixes)

**Goal**: Close all authentication and authorization bypasses.

| Task | Modules | Type | Test Required |
|------|---------|------|---------------|
| Add `@useAuth(BearerAuth)` to Training TypeSpec + regenerate | M8 | TypeSpec + codegen | API integration: verify 401 on unauthenticated call |
| Add officer role checks to `markComplete`, `createEvent`, `updateEvent`, `cancelEvent`, `bulkCreateEventSeries` | M8, M7 | Handler fix | API integration: role denial tests |
| Fix `listAttendance`, `listRegistrations` — add auth checks | M7 | Handler fix | API integration: 403 on unauthorized |
| Add org-scope checks to `getDocument`, `searchDocuments` | M10 | Handler fix | API integration: IDOR prevention |
| Add ownership check to `completeFileUpload` | M10 | Handler fix | API integration: 403 on wrong user |
| Add `requirePosition` to `getDocumentAccessLog` | M10 | Handler fix | API integration: officer-only |
| Add officer checks to `certifyElection`, `createElection` | M3 | Handler fix | API integration: role denial |
| Parameterize SQL in `createElection` | M3 | Handler fix | Unit test |
| Add officer checks to 6 special assessment routes | M2 | Handler fix | API integration: role denial |
| Add `authMiddleware` to `/persons/me/credits` | M9 | TypeSpec + codegen | API integration: 401 |
| Confirm `executeAccountDeletion` invocation path | M9 | Investigation | Manual confirmation |
| Write `officerAuthMiddleware` test suite | M12 | Test-only | 10+ assertions |
| Fix handlers returning 200 with error body | M12 | Handler fix | API integration |

**Proof**: All auth denial paths have API integration tests with explicit 401/403 assertions.

---

### Slice 2: Broken Features (P0/P1 — Estimated: 8 fixes)

**Goal**: Fix features that are actively broken in production.

| Task | Module | Type | Test Required |
|------|--------|------|---------------|
| Fix training form to use generated SDK hooks | M8 | Frontend fix | E2E: officer creates training |
| Fix `generateCertificatePdf` — returns HTML JSON not PDF | M10 | Handler fix | API integration: verify content-type |
| Fix settings general tab calling unregistered `GET /persons/me` | M9 | Frontend fix | E2E: settings page loads |
| Fix `ctx.req.json()` → `ctx.req.valid('json')` in all event handlers | M7 | Handler fix | API integration: invalid body returns 400 |
| Fix `ctx.req.json()` → `ctx.req.valid('json')` in all training handlers | M8 | Handler fix | API integration: invalid body returns 400 |
| Fix `registrationFee` cents conversion mismatch | M7 | Frontend/backend fix | API integration + E2E |
| Fix enrolled state resets on page refresh (local useState) | M8 | Frontend fix | E2E: enrollment persists |
| Fix credit compliance report hardcoded `requiredCredits=45` | M8 | Handler fix | Unit test |

**Proof**: Each fix has a regression test proving the behavior works end-to-end.

---

### Slice 3: E2E Coverage (P1 — Estimated: 12 new test files)

**Goal**: Cover all critical journeys that currently have zero E2E.

| Journey | Module | Priority | Test File |
|---------|--------|----------|-----------|
| Client books session → host confirms → completion | M7 Booking | P1 | `e2e/journeys/booking-flow.spec.ts` |
| Host rejects booking → slot released | M7 Booking | P1 | `e2e/journeys/booking-rejection.spec.ts` |
| Booking cancellation (client + host) | M7 Booking | P1 | `e2e/journeys/booking-cancel.spec.ts` |
| Officer cancel event → member sees cancelled | M7 Events | P1 | `e2e/officer/event-cancel.spec.ts` |
| Member cancel registration | M7 Events | P1 | `e2e/member/event-cancel-registration.spec.ts` |
| Officer creates training → member enrolls → completes → credits | M8 Training | P1 | `e2e/journeys/training-lifecycle.spec.ts` |
| CPD settings configuration | M8 Training | P1 | `e2e/officer/cpd-settings.spec.ts` |
| Account deletion request + grace period | M9 Person | P1 | `e2e/member/account-deletion.spec.ts` |
| Data export download | M9 Person | P1 | `e2e/member/data-export.spec.ts` |
| Document upload + download + access log | M10 Docs | P1 | `e2e/journeys/document-lifecycle.spec.ts` |
| Certificate generation + download | M10 Certs | P1 | `e2e/officer/certificate-generation.spec.ts` |
| Public event discovery | M7 Events | P2 | `e2e/public/discover-events.spec.ts` |

**Proof**: Each test exercises the full journey with real API calls and state verification.

---

### Slice 4: Permission Test Backfill (P1 — Estimated: 6 test files)

**Goal**: Every role-based permission rule has both allow and deny tests.

| Permission Rule | Module | Test Type |
|----------------|--------|-----------|
| Officer-only event CRUD (create/update/cancel/publish) | M7 | API integration |
| Officer-only check-in (deny member) | M7 | API integration |
| Booking ownership (client can't confirm, host can't book) | M7 | API integration |
| Document access by role (member vs officer vs admin) | M10 | API integration |
| Certificate issuance by role | M10 | API integration |
| Training CRUD by role | M8 | API integration |

---

### Slice 5: UX Polish (P2 — Estimated: 10 fixes)

**Goal**: Add missing confirmation dialogs, fix validation gaps.

| Task | Module |
|------|--------|
| Add confirmation dialog for booking cancel/reject | M7 |
| Add "Sign in to register" CTA on public event page | M7 |
| Add 0.5-increment validation to frontend credit amount field | M7 |
| Add confirmation dialog for training cancel/delete/complete | M8 |
| Add avatar upload UI to profile page | M9 |
| Fix profile to use `updateMyProfile` not `updatePerson` | M9 |
| Add membership check on org member pages | M11 |
| Fix OfficerMobileNav drawer close on navigation | M11 |
| Fix ErrorBoundary 401 to redirect to sign-in | M11 |
| Add file size limit consistency (25MB UI vs 50MB backend) | M10 |

---

### Slice 6: Dead Code Cleanup (P2/P3 — Estimated: 15 deletions)

**Goal**: Remove dead handlers, orphan routes, duplicate files.

| Task | Module |
|------|--------|
| Delete 8 dead person handler files (superseded by `My*` variants) | M9 |
| Delete/consolidate `my-cpd.tsx` vs `/my/credits` duplicate | M8 |
| Clean up courses sub-module (10+ orphan routes) | M8 |
| Remove `deleteMyAccount.ts` dead duplicate | M9 |
| Document or remove `exportPersonData.ts` unregistered handler | M9 |

---

## Product Decisions Required Before Implementation

| # | Question | Modules | Blocks Slice |
|---|---------|---------|-------------|
| 1 | Should event CRUD require officer role or just org membership? | M7 | Slice 1 |
| 2 | Should `listAttendance`/`listRegistrations` require auth? | M7 | Slice 1 |
| 3 | Accredited provider UI — admin app or memberry officer pages? | M8 | Slice 2 |
| 4 | Required CPD credits source of truth (45 vs 60)? | M8 | Slice 2 |
| 5 | Courses sub-module — planned feature or dead code? | M8 | Slice 6 |
| 6 | `executeAccountDeletion` — job-only or HTTP-exposed? | M9 | Slice 1 |
| 7 | Avatar upload UX flow (storage module first, then reference)? | M9 | Slice 5 |
| 8 | Admin person update capability — needed? | M9 | Slice 5 |

---

## Execution Rules

1. **Do not implement** until product decisions in Section above are answered
2. **Slice 1 (Auth) must complete before any release**
3. Each slice follows TDD: RED → GREEN → REFACTOR
4. Each fix requires proof artifact (test passing, screenshot, or log)
5. Slices 1-2 are sequential (auth first, then broken features)
6. Slices 3-6 can run in parallel after Slice 2
7. Do not run `10-tdd-execution-gate-prompt.md` until a specific slice is selected and approved
