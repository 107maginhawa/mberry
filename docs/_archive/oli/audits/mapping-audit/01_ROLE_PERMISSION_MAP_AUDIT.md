# 01 — Role and Permission Map Audit

**Date:** 2026-05-26
**Scope:** All role definitions, frontend/backend enforcement, test coverage
**Mode:** Read-only audit. No code modifications.

---

## 1. Role Inventory

### System Roles (Better-Auth)

| Role | Source File | Scope | Frontend Usage | Backend Usage | Test Coverage |
|------|-----------|-------|---------------|---------------|---------------|
| `user` | `services/api-ts/src/types/auth.ts` | Global | Default authenticated | Base auth check | ✓ Auth tests |
| `admin` | `services/api-ts/src/types/auth.ts` | Global | None (redirects to admin app) | Admin promotion on sign-up | ✓ Auth tests |
| `client` | `services/api-ts/src/types/auth.ts` | Global | Booking flows | `authMiddleware({ roles: ['client'] })` | Partial |
| `host` | `services/api-ts/src/types/auth.ts` | Global | Booking flows | `authMiddleware({ roles: ['host'] })` | Partial |

### Platform Admin Roles

| Role | Source File | Scope | Frontend Usage | Backend Usage | Test Coverage |
|------|-----------|-------|---------------|---------------|---------------|
| `super` | `handlers/platformadmin/repos/platform-admin.schema.ts` | Platform | `ROUTE_ROLES` matrix, full sidebar | `platformAdminAuthMiddleware()` | Unauthenticated only |
| `support` | Same | Platform | `ROUTE_ROLES` matrix, filtered sidebar | Same middleware | Unauthenticated only |
| `analyst` | Same | Platform | `ROUTE_ROLES` matrix, read-only sidebar | Same middleware | Unauthenticated only |

### Organization Roles (Officer Hierarchy)

| Role | Tier | Source File | Frontend Usage | Backend Usage | Test Coverage |
|------|------|-----------|---------------|---------------|---------------|
| `president` | 0 (highest) | `utils/org-auth.ts` | `POSITION_NAV_CONFIG` — all sections | `requirePosition()` — all ops | ✓ Allow + deny |
| `vice-president` | 1 | Same | Not in `POSITION_NAV_CONFIG` `[INFERRED]` | `hasMinimumRole()` | NONE |
| `secretary` | 2 | Same | `POSITION_NAV_CONFIG` — MEMBERS, COMMS, FEEDBACK | `requirePosition()` | ✓ Deny + partial allow |
| `treasurer` | 3 | Same | `POSITION_NAV_CONFIG` — FINANCES, DOCS | `requirePosition()` | ✓ Deny + allow (dues) |
| `board-member` | 4 | Same | Not in `POSITION_NAV_CONFIG` `[INFERRED]` | `hasMinimumRole()` | NONE |
| `officer` | 5 | Same | Generic officer check | `requireOfficerTerm()` | ✓ Allow (handwired) |
| `staff` | 6 | Same | Not in `POSITION_NAV_CONFIG` `[INFERRED]` | `hasMinimumRole()` | NONE |
| `member` | 7 (lowest) | Same | Auth-only (no role guard) | Org membership check | ✓ Strong deny |
| `society officer` | N/A | `config/position-nav.ts` | `POSITION_NAV_CONFIG` — ACTIVITIES, FEEDBACK, DOCS | `requirePosition()` | Partial deny |

### Domain-Specific Roles

| Role | Scope | Source File | Notes |
|------|-------|-----------|-------|
| Chat `member` | Per-room | `handlers/comms/repos/comms.schema.ts` | Chat room membership |
| Chat `admin` | Per-room | Same | Chat room admin |
| Committee `member` | Per-committee | `handlers/association:operations/repos/committee.schema.ts` | Committee membership |
| Committee `chairperson` | Per-committee | Same | Committee chair |
| Committee `vice_chairperson` | Per-committee | Same | Vice chair |

### Access Control Statements (Better-Auth AC Plugin)

| Role | Permissions | Source |
|------|-----------|--------|
| `patient` | `patient:read`, `patient:update`, `patient:consent:manage`, `communication:send/read`, `file:upload/read` | `utils/auth.ts` |
| `provider` | `provider:read/update`, `patient:read/search`, `communication:*`, `file:upload/read/download` | Same |
| `admin` | `admin:*`, `patient:*`, `provider:*`, `communication:*`, `file:*`, `audit:read`, `system:manage`, `user:impersonate` | Same |

**Note:** These AC statements appear to be from a healthcare context. `[NEEDS PRODUCT DECISION]` — verify alignment with current AMS domain roles.

---

## 2. Role Access Matrix

### Memberry App — Member Routes

| Route | Guest | Auth User | Member | Officer | Notes |
|-------|-------|----------|--------|---------|-------|
| `/auth/sign-in` | ✓ | Redirect | Redirect | Redirect | `requireGuest` |
| `/dashboard` | Redirect | ✓ | ✓ | ✓ | `requireAuth` |
| `/my/profile` | Redirect | ✓ | ✓ | ✓ | Auth only |
| `/my/billing` | Redirect | ✓ | ✓ | ✓ | Auth only |
| `/my/bookings/*` | Redirect | ✓ | ✓ | ✓ | Auth only |
| `/org/:slug/home` | Redirect | ✓ | ✓ | ✓ | Auth + org context |
| `/org/:slug/directory` | Redirect | ✓ | ✓ | ✓ | Auth + org context |
| `/org/:slug/elections/*` | Redirect | ✓ | ✓ | ✓ | Auth + org context |
| `/org/:slug/messages/*` | Redirect | ✓ | ✓ | ✓ | Auth + org context |
| `/discover/events` | ✓ | ✓ | ✓ | ✓ | Public |

### Memberry App — Officer Routes

| Route | Member | Officer (generic) | Treasurer | Secretary | President | Society Officer |
|-------|--------|-------------------|-----------|-----------|-----------|----------------|
| `/org/:slug/officer/dashboard` | 403/redirect | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/org/:slug/officer/roster` | 403/redirect | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/org/:slug/officer/dues/*` | 403/redirect | `[UNCLEAR]` | ✓ | 403 | ✓ | 403 |
| `/org/:slug/officer/events/*` | 403/redirect | `[UNCLEAR]` | 403 | `[UNCLEAR]` | ✓ | ✓ |
| `/org/:slug/officer/training/*` | 403/redirect | `[UNCLEAR]` | 403 | `[UNCLEAR]` | ✓ | ✓ |
| `/org/:slug/officer/communications/*` | 403/redirect | `[UNCLEAR]` | 403 | ✓ | ✓ | `[UNCLEAR]` |
| `/org/:slug/officer/elections/*` | 403/redirect | `[UNCLEAR]` | 403 | 403 | ✓ | 403 |
| `/org/:slug/officer/settings/*` | 403/redirect | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/org/:slug/officer/applications` | 403/redirect | ✓ | `[UNCLEAR]` | ✓ | ✓ | `[UNCLEAR]` |

**Note:** Many cells marked `[UNCLEAR]` — frontend sidebar hides nav items per `POSITION_NAV_CONFIG`, but backend enforcement depends on individual handler `requirePosition()` calls. Mismatch risk.

### Admin App

| Route | Unauthenticated | super | support | analyst |
|-------|----------------|-------|---------|---------|
| `/` | Redirect | ✓ | ✓ | ✓ |
| `/associations` | Redirect | ✓ | ✓ | ✓ |
| `/organizations` | Redirect | ✓ | ✓ | ✓ |
| `/members` | Redirect | ✓ | ✓ | ✓ |
| `/operators` | Redirect | ✓ | 403 | 403 |
| `/impersonate` | Redirect | ✓ | 403 | 403 |
| `/feature-flags` | Redirect | ✓ | 403 | 403 |
| `/communications/templates` | Redirect | ✓ | 403 | 403 |
| `/verifications` | Redirect | ✓ | ✓ | 403 |
| `/audit` | Redirect | ✓ | ✓ | 403 |
| `/committees` | Redirect | ✓ | ✓ | 403 |
| `/events` | Redirect | ✓ | ✓ | 403 |
| `/compliance` | Redirect | ✓ | ✓ | ✓ |
| `/national-dashboard` | Redirect | ✓ | ✓ | ✓ |

---

## 3. Permission Gap Report

| ID | Gap | Severity | Role | Route/API/Component | Evidence | Risk | Recommended Test |
|----|-----|----------|------|---------------------|----------|------|-----------------|
| PG-01 | No membership-status check on member routes | P1 | Lapsed/suspended member | All `/org/:slug/*` member routes | `_authenticated.tsx` only checks auth, not membership status | Lapsed members access active-only features | API integration test `[NEEDS PRODUCT DECISION]` |
| PG-02 | `vice-president` not in `POSITION_NAV_CONFIG` | P1 | vice-president | Officer sidebar | `config/position-nav.ts` only has 4 positions | VP sees no nav items in officer dashboard | Component test + E2E |
| PG-03 | `board-member` not in `POSITION_NAV_CONFIG` | P1 | board-member | Officer sidebar | Same as PG-02 | Board member sees empty officer nav | Same |
| PG-04 | `staff` not in `POSITION_NAV_CONFIG` | P1 | staff | Officer sidebar | Same as PG-02 | Staff sees empty officer nav | Same |
| PG-05 | Frontend hides dues nav for secretary, but backend enforcement per-handler | P2 | secretary | `/org/:slug/officer/dues/*` | Sidebar hides link, but URL direct access unclear | Secretary could navigate directly to hidden routes | E2E direct-URL test |
| PG-06 | Admin ROUTE_ROLES only enforced in sidebar filter, not in route guards | P1 | analyst | Admin restricted routes | `__root.tsx` filters sidebar but no `beforeLoad` per-route guard | Analyst can navigate directly to `/operators` `[NEEDS MANUAL CONFIRMATION]` | E2E direct-URL test |
| PG-07 | Impersonation write-block tested only in domain gate, not E2E | P2 | Impersonating admin | All write operations | `auth-gate-coverage.test.ts` tests `isWriteBlocked()` | Need integration-level confirmation | API integration test |
| PG-08 | `officer` (generic, tier 5) not in POSITION_NAV_CONFIG | P1 | Generic officer | Officer sidebar | `config/position-nav.ts` has no `officer` key | Generic officers see empty nav | Component test |
| PG-09 | No E2E test for officer ALLOW paths | P1 | Officers (all positions) | Officer routes | `role-boundaries.spec.ts` only tests denials | Can't confirm officers actually CAN access | E2E allow test |
| PG-10 | No admin role-specific E2E tests | P1 | super/support/analyst | Admin routes | `wave7-role-gate.spec.ts` only tests unauthenticated | No proof admin roles work correctly | E2E per-role test |
| PG-11 | Cross-org isolation only tested for GET | P1 | Officer (cross-org) | Write endpoints | `route-protection-idor.test.ts` only GETs | Write IDOR unverified | API integration test |
| PG-12 | `patient`/`provider` access control statements in AMS codebase | P2 | N/A | `utils/auth.ts` | Healthcare-specific AC statements | May not align with current domain | Code review `[NEEDS PRODUCT DECISION]` |
| PG-13 | 2FA enforcement only in production | P2 | Privileged positions | Officer auth | `officer-auth.ts` skips 2FA in dev | Can't test 2FA flow locally | Integration test with env flag |
| PG-14 | No test for role session invalidation | P2 | Any user whose role changes | Session management | `core/auth.ts` deletes sessions on role change | Untested session revocation | API integration test |
| PG-15 | Officer role cached 5min in frontend | P2 | Newly assigned/removed officer | Officer features | `_authenticated.tsx` — `staleTime: 5 * 60_000` | 5-min window of stale permissions | `[NEEDS PRODUCT DECISION]` — acceptable? |

---

## 4. Test Coverage Recommendations

| Permission Rule | Existing Test | Missing Test | Recommended Type | Severity |
|----------------|--------------|-------------|-----------------|----------|
| Member cannot access officer routes | ✓ `role-boundaries.spec.ts` (6 deny) | Officer CAN access (allow) | E2E | P1 |
| Treasurer restricted to dues only | ✓ `role-boundaries.spec.ts` + `position-rbac.test.ts` | Society officer allow tests | API integration | P2 |
| Secretary restricted to comms/roster | ✓ `role-boundaries.spec.ts` + `position-rbac.test.ts` | Secretary explicit allows | API integration | P2 |
| President unrestricted | ✓ `position-rbac.test.ts` (6 allows) | — | — | — |
| Admin routes block unauthenticated | ✓ `wave7-role-gate.spec.ts` (4 tests) | Admin role-specific allow/deny | E2E | P1 |
| Admin routes block non-admin | ✓ `route-protection-admin.test.ts` (6 tests) | Per-role matrix (super/support/analyst) | API + E2E | P1 |
| Cross-org isolation (GET) | ✓ `route-protection-idor.test.ts` (8 tests) | Cross-org isolation (writes) | API integration | P1 |
| Impersonation blocks writes | ✓ `auth-gate-coverage.test.ts` (domain fn) | Middleware-level write block test | API integration | P2 |
| Member can read own data | ✓ `route-protection-association.test.ts` | — | — | — |
| Membership status gates | NONE | Lapsed/suspended member access | API + E2E | P1 |
| VP/board-member/staff officer nav | NONE | All 3 positions see correct nav | Component + E2E | P1 |
| Role session invalidation | NONE | Session deleted on role change | API integration | P2 |
| Analyst cannot access super routes | NONE | Direct URL navigation test | E2E | P1 |

---

## 5. Privileged Position 2FA Enforcement

| Position | 2FA Required? | Backend Enforcement | Frontend Enforcement | Test |
|----------|-------------|---------------------|---------------------|------|
| President | Yes (prod) | `officer-auth.ts` line 53 | None `[INFERRED]` | NONE |
| Treasurer | Yes (prod) | Same | None `[INFERRED]` | NONE |
| Secretary | Yes (prod) | Same | None `[INFERRED]` | NONE |
| Others | No | N/A | N/A | N/A |

**Note:** 2FA skipped in development (`NODE_ENV !== 'production'`). No frontend 2FA prompt or enforcement found. `[NEEDS MANUAL CONFIRMATION]`

---

## Gate Evaluation: Audit 02

| Criterion | Status |
|-----------|--------|
| All role definitions found | PASS |
| Role inventory with sources | PASS |
| Protected routes identified | PASS |
| Protected actions identified | PASS |
| Frontend/backend comparison | PASS |
| Test coverage assessed | PASS |
| Permission gaps documented with severity | PASS |
| Recommendations with test types | PASS |

**Gate Result: PASS**

---

## Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | COMPLETE | PASS | `01_ROLE_PERMISSION_MAP_AUDIT.md` |
| 03 — Route Navigation | PENDING | — | — |
| 04 — Frontend Interaction Integrity | PENDING | — | — |
| 05 — Form/Modal/Table Action | PENDING | — | — |
| 06 — Backend API Contract Alignment | PENDING | — | — |
| 07 — Role-Based Journey Map | PENDING | — | — |
| 08 — Test Confidence Gap | PENDING | — | — |
| 09 — Prioritized Stabilization Plan | PENDING | — | — |

**P0 findings so far:** 0
**P1 findings so far:** 8 (PG-01, PG-02, PG-03, PG-04, PG-06, PG-08, PG-09, PG-10, PG-11)
**Carry forward to Audit 09:** All PG-* items
