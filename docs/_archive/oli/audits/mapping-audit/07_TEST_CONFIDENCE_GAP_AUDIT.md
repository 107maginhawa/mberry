# 07 — Test Confidence Gap Audit

**Date:** 2026-05-26
**Scope:** Test quality assessment, behavior-to-test mapping, confidence scoring
**Mode:** Read-only audit. No code modifications.
**Sources:** All prior audit findings (01-07) + test file exploration from Audit 01

---

## 1. Test Structure Summary

| Test Type | Location | Framework | Count | Notes |
|-----------|----------|-----------|-------|-------|
| API Unit | `services/api-ts/src/**/*.test.ts` | Bun test | 500 files / 6,629 cases | STRONG — good handler + repo coverage |
| Frontend Unit | `apps/memberry/src/**/*.test.ts` | Vitest + happy-dom | 97 files / 764 cases | WEAK — 29% threshold, schemas + utils mostly |
| E2E (Memberry) | `apps/memberry/tests/e2e/` | Playwright | 116 files / 673 cases | MODERATE — auth strong, officer weak |
| E2E (Admin) | `apps/admin/tests/e2e/` | Playwright | 8 files / 38 cases | WEAK — smoke + basic routes only |
| Contract | `specs/api/tests/contract/` | Hurl | 97 files | STRONG — comprehensive flow coverage |
| Route Protection | `services/api-ts/src/tests/route-protection-*.test.ts` | Bun test | 4 files / 28+ cases | MODERATE — GETs covered, writes missing |
| Position RBAC | `services/api-ts/src/tests/position-rbac.test.ts` | Bun test | 26 cases | STRONG — deny + allow paths |
| Domain Gates | `services/api-ts/src/handlers/auth-gate-coverage.test.ts` | Bun test | 40+ cases | STRONG — all gates tested |

---

## 2. Behavior-to-Test Matrix

### Critical Business Behaviors

| Behavior | Role | Source | Existing Test | Quality | Missing | Severity |
|----------|------|--------|-------------|---------|---------|----------|
| User authentication | All | Auth middleware | ✓ `auth.spec.ts` (14 E2E) + `auth.test.ts` (API) | STRONG | — | — |
| Session management | All | Better-Auth | ✓ `session-*.spec.ts` (E2E) | STRONG | — | — |
| Member can't access officer routes | Member | Route guards | ✓ `role-boundaries.spec.ts` (6 deny) | STRONG | Officer ALLOW tests | P1 |
| Treasurer restricted to dues | Treasurer | Position check | ✓ `position-rbac.test.ts` (7 deny + 1 allow) | STRONG | — | — |
| Secretary restricted from dues | Secretary | Position check | ✓ `position-rbac.test.ts` (5 deny) | MODERATE | Explicit allows | P2 |
| President unrestricted | President | Position check | ✓ `position-rbac.test.ts` (6 allows) | STRONG | — | — |
| Cross-org isolation | Officers | Org context | ✓ `route-protection-idor.test.ts` (8 GET) | MODERATE | Write IDOR tests | P1 |
| Dues payment recording | Treasurer | Handler | ✗ NONE (behavior) | NONE | Full test | P1 |
| Refund processing | Treasurer | Handler | ✗ NONE (behavior) | NONE | Full test | P1 |
| Election vote casting | Member | Handler | ✗ NONE (behavior) | NONE | Full test | P1 |
| Election lifecycle states | Officer | Handler | Partial (domain gates) | WEAK | State machine test | P1 |
| Membership status transitions | System | Repo | ✓ `status-transitions.test.ts` (120) | STRONG | — | — |
| Credit issuance/tracking | System | Handler | ✓ `credits.test.ts` (94) | STRONG | — | — |
| Event registration | Member | Handler | ✓ `events.test.ts` (83) | STRONG | — | — |
| Impersonation write block | Admin | Middleware | ✓ Domain gate (7 tests) | MODERATE | Middleware integration | P2 |
| Admin route protection | Admin roles | Middleware | ✓ `route-protection-admin.test.ts` (6) | MODERATE | Per-role matrix | P1 |
| Officer term assignment | President | Handler | ✗ NONE | NONE | Full test | P1 |
| Announcement broadcast | Secretary | Handler | ✗ NONE (behavior) | NONE | Full test | P1 |
| Member import | Secretary | Handler | ✗ NONE | NONE | Full test | P1 |
| Application processing | Secretary | Handler | ✗ NONE (behavior) | NONE | Full test | P1 |
| Feature flag CRUD | super | Handler | ✗ NONE | NONE | Full test | P2 |
| Void event credits | Officer | Handler | N/A — endpoint missing | N/A | Implement endpoint | P0 |

### Frontend Behaviors

| Behavior | Existing Test | Quality | Missing | Severity |
|----------|-------------|---------|---------|----------|
| Profile form save | ✓ `profile.spec.ts` | STRONG | Other form variants | P2 |
| Org settings save | ✓ `settings.spec.ts` | MODERATE | Complete settings | P2 |
| Table pagination/filter | ✗ NONE | NONE | DataTable interactions | P2 |
| Modal open/close/confirm | ✗ NONE | NONE | ConfirmDialog E2E | P2 |
| Empty state rendering | ✗ NONE | NONE | Empty state assertions | P3 |
| Error state rendering | ✗ NONE | NONE | API error → UI error | P2 |
| Loading state rendering | ✗ NONE | NONE | Skeleton/spinner assertions | P3 |
| Toast notifications | ✗ NONE | NONE | Success/error toast | P3 |
| Mobile responsive layout | ✓ `viewport.spec.ts` (13) | MODERATE | More breakpoints | P3 |
| Navigation smoke (all routes) | Partial | WEAK | 60% of routes untested | P1 |

---

## 3. Weak Test Report

| Test File | Pattern | Why Weak | Improvement | Severity |
|-----------|---------|----------|-------------|----------|
| `wave7-role-gate.spec.ts` | Only tests unauthenticated access | Doesn't test actual role enforcement | Add per-role allow/deny | P1 |
| `cross-role-tests.spec.ts` | Only 3 tests — visibility check | No API-level role verification | Add API call assertions | P2 |
| `role-assignment.spec.ts` | Only tests page loads | No assignment action tested | Test actual officer assignment | P2 |
| `admin-smoke.spec.ts` | Only 2 render tests | No interaction tested | Add CRUD actions | P2 |
| `custom-routes-auth.test.ts` | Only tests 401 (unauthenticated) | No role-specific denials | Add 403 tests per role | P1 |
| Stub E2E tests (12 files) | Excluded from test suite | Planned features untested | Move to active suite when ready | P3 |
| Skipped tests (14) | `test.skip()` across files | Blocked by seed data/env | Fix blockers or document | P2 |
| TODO tests (21) | `test.todo()` | Unimplemented specs | Implement or remove | P2 |

---

## 4. Missing Test Report — Consolidated from All Audits

### P0 — Critical

| Item | Risk | Test Type | Assertion | Source |
|------|------|-----------|-----------|--------|
| Void event credits endpoint | Feature broken — 404 | Implement endpoint first, then API test | Endpoint returns 200, credits revoked | CD-01 |

### P1 — Major

| Item | Risk | Test Type | Assertion | Source |
|------|------|-----------|-----------|--------|
| Officer ALLOW E2E tests | False confidence in deny-only tests | E2E | Officer CAN access dashboard, roster, events | PG-09 |
| Admin role matrix E2E | Analyst may access super routes | E2E | super→200, analyst→403 for `/operators` | PG-06, PG-10 |
| Cross-org write IDOR | Data leakage across orgs | API integration | POST/PATCH/DELETE to other org → 403 | PG-11 |
| Dues payment recording | Financial data integrity | API integration + E2E | Payment recorded, balance updated | BJ-12 |
| Refund processing | Financial, destructive | API integration + E2E | Refund issued, fund reversed | Audit 04 |
| Election vote casting | Governance integrity | API integration + E2E | Vote recorded, tally updated, no double-vote | BJ-11 |
| Officer term CRUD | Access control changes | API integration | Assign/remove → role changes reflected | Audit 04 |
| Announcement broadcast | Mass communication | API integration + E2E | Sent to audience, logged | Audit 04 |
| Member import | Bulk data integrity | API integration | CSV parsed, members created, errors reported | Audit 04 |
| Application processing | Membership flow | API integration | Approve → active, reject → rejected | Audit 04 |
| Membership status gate | Lapsed access risk | API integration | Lapsed member → 403 on active-only endpoints | PG-01 |
| VP/board/staff nav config | Broken officer UX | Component + E2E | These roles see correct nav items | PG-02/03/04/08 |
| Navigation smoke (60% gaps) | Dead links undetected | E2E | All routes render without error | Audit 03 |
| Start/end voting confirmation | Irreversible without confirm | E2E | Confirmation dialog shown before state change | BI-09 |
| Feature flag delete confirmation | Destructive without confirm | E2E | ConfirmDialog before delete | BI-02 |

### P2 — Minor

| Item | Risk | Test Type | Source |
|------|------|-----------|--------|
| Training form validation | Inconsistent pattern | Component test | FG-01 |
| Form double-submit prevention | Data duplication | Component test | BI-07 |
| NPS modal error handling | Lost feedback | Component test | BI-01 |
| Error state rendering | Silent failures | Component test | Audit 03 |
| Empty state rendering | Blank pages | Component test | Audit 03 |
| Not-found on detail routes | Confusing UX | E2E | Audit 03 |
| Table interaction tests | Untested CRUD in tables | E2E | TG-03 |
| Frontend Zod vs backend TypeSpec alignment | Validation drift | Contract test | CD-05 |

---

## 5. Confidence Score

| Layer | Score | Main Gap |
|-------|-------|----------|
| **Coverage Integrity** | 5/10 | 29% frontend threshold; 60% of routes have no E2E; admin app nearly untested |
| **Behavior Traceability** | 6/10 | Strong API unit tests + domain gates. Weak: no behavior tests for financial ops, elections, officer management |
| **Test Quality** | 7/10 | API tests are STRONG (real assertions on outcomes). E2E tests are MODERATE (deny-only for roles, no interaction tests). Weak tests identified but manageable |
| **Release Gate Readiness** | 4/10 | No CI gate on E2E. 43 skipped/TODO tests. 1 P0 broken feature. 15 P1 critical gaps. Admin app essentially ungated |
| **Overall** | **5.5/10** | Good backend foundation. Frontend and journey-level confidence insufficient for production releases |

### Score Breakdown

**What's strong:**
- 6,629 API unit tests with real assertions
- 97 Hurl contract tests covering happy paths
- Position RBAC tests (deny + allow)
- Membership status transition tests (120 cases)
- Domain gate tests (40+ with both paths)
- Auth/session E2E tests (30+ cases)

**What's weak:**
- No E2E for financial operations (dues, payments, refunds)
- No E2E for governance operations (elections, officer management)
- No E2E for communication operations (announcements)
- Admin app has 8 test files / 38 cases for 23 routes
- Frontend unit coverage at 29% (well below 80% standard)
- Role enforcement tests are deny-only (no allow verification)
- Cross-org isolation tested only for reads, not writes
- 1 broken feature (void-event credits)

---

## Gate Evaluation: Audit 08

| Criterion | Status |
|-----------|--------|
| Test structure detected | PASS |
| Behavior inventory built | PASS |
| Behavior mapped to tests | PASS |
| Assertion quality classified | PASS |
| Bad test patterns checked | PASS |
| Role/permission tests checked | PASS |
| Frontend journey tests checked | PASS |
| Confidence scored | PASS |

**Gate Result: PASS**

---

## Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | COMPLETE | PASS | `01_ROLE_PERMISSION_MAP_AUDIT.md` |
| 03 — Route Navigation | COMPLETE | PASS | `02_ROUTE_NAVIGATION_AUDIT.md` |
| 04 — Frontend Interaction Integrity | COMPLETE | PASS | `03_FRONTEND_INTERACTION_INTEGRITY_AUDIT.md` |
| 05 — Form/Modal/Table Action | COMPLETE | PASS | `04_FORM_MODAL_TABLE_ACTION_AUDIT.md` |
| 06 — Backend API Contract Alignment | COMPLETE | PASS | `05_BACKEND_API_CONTRACT_ALIGNMENT_AUDIT.md` |
| 07 — Role-Based Journey Map | COMPLETE | PASS | `06_ROLE_BASED_JOURNEY_MAP_AUDIT.md` |
| 08 — Test Confidence Gap | COMPLETE | PASS | `07_TEST_CONFIDENCE_GAP_AUDIT.md` |
| 09 — Prioritized Stabilization Plan | PENDING | — | — |

**Cumulative:** P0: 1 | P1: 18 | P2: 16+ | P3: 5+
