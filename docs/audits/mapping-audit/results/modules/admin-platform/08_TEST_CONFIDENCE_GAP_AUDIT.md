# Audit 08 — Test Confidence Gap: Admin/Platform Module

**Module**: `platformadmin`
**Date**: 2026-05-26
**Auditor**: Claude Code (automated)
**Branch**: `audit/codebase-improvements`

---

## 1. Test Structure Summary

| Layer | Framework | Location | Count |
|---|---|---|---|
| Unit / Handler | Bun test (`bun:test`) | `services/api-ts/src/handlers/platformadmin/*.test.ts` | 27 files, 405 assertions |
| Route protection | Bun test | `services/api-ts/src/tests/route-protection-admin.test.ts` | 1 file, 6 tests |
| Contract (Hurl) | Hurl | `specs/api/tests/contract/admin-flow.hurl` | 1 file, 20 steps |
| E2E (Playwright) | Playwright | `apps/admin/tests/e2e/` | 8 spec files |
| Frontend component | — | — | **NONE** (no vitest/jest in admin app) |

**Backend total**: 27 handler test files + 1 route-protection file = **411 assertions** across 28 files.

**E2E total**: 8 spec files; test counts vary by file (see §3).

---

## 2. E2E / Playwright Setup Summary

**Config**: `apps/admin/playwright.config.ts`
**Base URL**: `http://localhost:3003`
**Auth helper**: `apps/admin/tests/e2e/helpers/auth.ts` — `signInAndNavigate(page, path)`

| Spec File | Tests | Auth Pattern | Quality |
|---|---|---|---|
| `admin-smoke.spec.ts` | 2 | `signInAndNavigate` + unauthenticated | WEAK — text-match only (`text=Memberry Admin`) |
| `admin-routes.spec.ts` | 3 | `signInAndNavigate` | WEAK — `hasHeading \|\| hasContent` boolean only |
| `associations.spec.ts` | unknown detail, CRUD-shaped | `signInAndNavigate` + API calls | MODERATE (read §6) |
| `organizations.spec.ts` | CRUD + non-admin block | `signInAndNavigate` + API request | MODERATE — verifies table visible, API status codes |
| `members.spec.ts` | unknown detail | `signInAndNavigate` | UNKNOWN |
| `audit.spec.ts` | unknown detail | `signInAndNavigate` | UNKNOWN |
| `wave7-role-gate.spec.ts` | 4 (one per route) | unauthenticated only | MODERATE — verifies sidebar + heading NOT visible |
| `wave7-routes.spec.ts` | 5 | `signInAndNavigate` | MODERATE — heading + selector checks, not data verification |

**No component tests exist.** The admin app has zero vitest/jest coverage at the component or page level.

---

## 3. Behavior Inventory

| # | Behavior | Description | Priority |
|---|---|---|---|
| B1 | Non-admin blocked from `/admin/*` | Unauthenticated and non-admin users cannot reach any admin route | Core |
| B2 | Platform admin can access `/admin/*` | Authenticated admin sees dashboard and sub-pages | Core |
| B3 | Super admin CRUD on associations | create/get/list/update/delete associations | Core |
| B4 | Super admin CRUD on organizations | create/get/list/update/delete/transition orgs | Core |
| B5 | Super admin manage operators | invite/list/update/revoke admin users | Core |
| B6 | Super admin feature flag CRUD | set/list/delete flags per org or globally | Core |
| B7 | Impersonation with audit trail | start/end impersonation session; audit event emitted | Core |
| B8 | National dashboard aggregation | cross-chapter metrics aggregated per association | Core |
| B9 | National dashboard access control (BR-36) | platform_admin + designated national_officers only; chapter officers denied | Core |
| B10 | Admin role gate (sub-roles) | super/support/analyst roles have distinct permission scopes | Core |
| B11 | Analyst denied mutations | analyst role rejected on any state-changing endpoint | P1 gap |
| B12 | Support denied operator management | support role rejected on invite/revoke/update admin endpoints | P1 gap |
| B13 | Sub-role enforcement in middleware | `platformAdminAuthMiddleware` rejects wrong sub-role at wire level | P1 gap |
| B14 | Impersonation blocks admin-on-admin | cannot impersonate another platform admin user | Core |
| B15 | Last super admin protection | revoking the last super admin is rejected | Core |
| B16 | Public org lookup (no auth) | `/organizations/:slug` and list-public-orgs work without session | Core |
| B17 | Committee cross-org list | `listAllCommittees` returns committees across all orgs | Core |
| B18 | Dashboard quick actions role-filtered | UI only shows actions permitted by caller's sub-role | P2 gap |
| B19 | Org status transition confirmation | UI requires explicit confirmation before status change | P1 gap |
| B20 | Feature flag delete confirmation | UI requires confirmation dialog before flag deletion | P2 gap |

---

## 4. Behavior-to-Test Matrix

| Behavior | Unit/Handler Test | Route Protection | Contract (Hurl) | E2E Playwright | Overall |
|---|---|---|---|---|---|
| B1 Non-admin blocked | route-protection-admin (6 tests, 3 routes) | ✅ | step 0 (anon→401) | admin-smoke + wave7-role-gate | STRONG |
| B2 Admin can access | platformadmin.test.ts (35 assertions) | ✅ | steps 1-2 (sign-in + verify-role) | admin-smoke | STRONG |
| B3 Assoc CRUD | createAssociation(5), getAssociation(6), listAssociations(7), updateAssociation(5), deleteAssociation(4) | — | steps 8-11, 19 | associations.spec.ts | MODERATE |
| B4 Org CRUD | createOrganization(6), getOrganization(5), getOrganizationBySlug(27), listOrganizations(7), updateOrganization(5), listPublicOrgs(26) | — | steps 3-7 | organizations.spec.ts | MODERATE |
| B5 Operator management | inviteAdmin(5), listAdmins(6), updateAdmin(8), revokeAdmin(6) | — | steps 12-15 | — | MODERATE |
| B6 Feature flag CRUD | setFeatureFlag(10), listFeatureFlags(5), deleteFeatureFlag(4) | — | steps 16-18 | admin-routes (page load only) | STRONG (backend), WEAK (E2E) |
| B7 Impersonation + audit | startImpersonation(19), endImpersonation(11) | — | — | admin-routes (page load only) | STRONG (backend), WEAK (E2E) |
| B8 Dashboard aggregation | ac-m14.national-dashboard(47) | — | — | wave7-routes (heading check) | STRONG (backend), WEAK (E2E) |
| B9 Dashboard access BR-36 | br-36.national-dashboard(99) | route-protection for 3 routes | — | wave7-role-gate (4 routes, no-auth only) | STRONG (backend), MODERATE (E2E) |
| B10 Sub-role gate | ac-m03.platform-admin(25) | — | — | — | STRONG (unit), NO E2E |
| B11 Analyst denied mutations | **NONE** | **NONE** | **NONE** | **NONE** | **MISSING [P1]** |
| B12 Support denied operator mgmt | **NONE** | **NONE** | **NONE** | **NONE** | **MISSING [P1]** |
| B13 Sub-role in middleware | **NONE** (middleware tested as black-box only) | **NONE** | **NONE** | **NONE** | **MISSING [P1]** |
| B14 Admin-on-admin impersonation blocked | startImpersonation.test.ts (ForbiddenError assertion) | — | — | — | STRONG (unit) |
| B15 Last super admin protection | revokeAdmin.test.ts (6 assertions; scope unclear) | — | — | — | MODERATE |
| B16 Public org lookup | getOrganizationBySlug(27), listPublicOrgs(26) = 53 combined | — | — | — | STRONG (unit), NO E2E |
| B17 Committee cross-org | listAllCommittees(14) | route-protection for committees route | — | wave7-routes (heading check) | STRONG (backend), WEAK (E2E) |
| B18 Dashboard quick actions UI | **NONE** | — | — | **NONE** | **MISSING [P2]** |
| B19 Org status transition UI confirm | transitionOrgStatus.test.ts (9 backend assertions) | — | Hurl step 7 (`status >= 200`) | **NONE** | **MISSING [P1] (UI layer)** |
| B20 Feature flag delete UI confirm | deleteFeatureFlag(4 backend assertions) | — | Hurl step 18 | **NONE** | **MISSING [P2] (UI layer)** |

---

## 5. E2E Journey Coverage Matrix

| User Journey | Pages Visited | Data Verified | Role Scenarios | Quality |
|---|---|---|---|---|
| Admin signs in → sees dashboard | `/` | text "Memberry Admin" only | admin only | WEAK |
| Unauthenticated blocked from dashboard | `/` | heading NOT visible | no-auth only | MODERATE |
| Admin views feature-flags page | `/feature-flags` | `hasHeading \|\| hasContent` only | admin only | WEAK |
| Admin views operators page | `/operators` | `hasHeading \|\| hasContent` only | admin only | WEAK |
| Admin views impersonate page | `/impersonate` | `hasHeading \|\| hasContent` only | admin only | WEAK |
| Admin views national-dashboard | `/national-dashboard` | heading visible + association selector visible | admin only | MODERATE |
| Admin views events | `/events` | heading + search + table/empty state | admin only | MODERATE |
| Admin views committees | `/committees` | heading + stats cards + search input | admin only | MODERATE |
| Dashboard recent activity visible | `/` | text "National Dashboard", "Events", "Training", "Recent Activity" heading | admin only | MODERATE |
| Wave 7 routes block unauthenticated | 4 routes | sidebar + heading NOT visible | no-auth only | MODERATE |
| Organizations CRUD | `/organizations` via API + page | table visible; API status codes checked | admin + non-admin block | MODERATE |
| **Full impersonation flow** | — | — | — | **MISSING** |
| **Feature flag create/delete with confirmation** | — | — | — | **MISSING** |
| **Analyst sub-role denied mutations in UI** | — | — | — | **MISSING** |
| **Org status transition with confirmation dialog** | — | — | — | **MISSING** |
| **National dashboard data loads real aggregates** | — | — | — | **MISSING** |

---

## 6. Role and Permission Test Matrix

| Role | Can Access Admin | Mutations Allowed | Operator Management | Impersonation | Tested At |
|---|---|---|---|---|---|
| `super` admin | ✅ | ✅ all | ✅ | ✅ | Unit (ac-m03, startImpersonation) |
| `support` admin | ✅ | ✅ (subset) | ❌ (should be denied) | ✅ | Unit only for impersonation; **operator denial: MISSING** |
| `analyst` admin | ✅ read-only | ❌ (should be denied) | ❌ (should be denied) | ❌ | Unit only for impersonation denial; **mutation denial: MISSING** |
| Non-admin user | ❌ | N/A | N/A | N/A | route-protection-admin.test.ts (3 routes) + wave7-role-gate (4 routes) |
| Unauthenticated | ❌ | N/A | N/A | N/A | route-protection-admin.test.ts + admin-smoke + wave7-role-gate |

**Critical gap**: Sub-role enforcement (analyst vs support vs super) is only tested at the *handler* level for impersonation (`startImpersonation.test.ts` correctly rejects analyst). There are **no tests** verifying that analyst cannot call mutation endpoints (create/update/delete org, assoc, flags) or that support cannot call operator management endpoints (invite/revoke admin). The `platformAdminAuthMiddleware` sub-role path is untested as a middleware unit.

---

## 7. Frontend Journey Test Matrix

| Feature | UI Renders | User Interaction | Data Loaded | Error States | Role Gating |
|---|---|---|---|---|---|
| Dashboard overview | MODERATE (text check) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Organizations list + CRUD | MODERATE (table visible) | PARTIAL (API call via request()) | NOT TESTED | NOT TESTED | PARTIAL (non-admin redirect) |
| Associations list + CRUD | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | NOT TESTED |
| Feature flags list + set/delete | WEAK (page load) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Operators list + invite/revoke | WEAK (page load) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Impersonation form + start/end | WEAK (page load) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| National dashboard | MODERATE (heading + selector) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Events list | MODERATE (heading + table/empty) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Training list | MODERATE (heading + table/empty) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Committees list | MODERATE (heading + stats) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Audit log | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | NOT TESTED |
| Members | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | NOT TESTED |

**No frontend tests verify actual data from the API** (no assertions on row counts, IDs, or field values returned by real API calls). All E2E assertions stop at "UI element is visible" or "heading text matches".

---

## 8. API and Backend Test Matrix

### Handler Unit Tests

| Handler File | Assertions | Covers | Gaps |
|---|---|---|---|
| `platformadmin.test.ts` | 35 | Core CRUD scaffold, auth guards | No sub-role mutation denial |
| `ac-m03.platform-admin.test.ts` | 25 | Sub-role rules: super/support/analyst permissions | No middleware integration; pure domain rules only |
| `ac-m14.national-dashboard.test.ts` | 47 | Aggregation logic, access scoping, privacy suppression, export audit, data accuracy | No integration with real DB; pure function tests |
| `br-36.national-dashboard.test.ts` | 99 | Access control enforcement, small-chapter privacy, cross-chapter denial, designation workflow | No integration; pure domain logic |
| `startImpersonation.test.ts` | 19 | Super/support allowed, analyst denied, admin-not-found, 30-min expiry, audit capture | Audit capture has conditional skip (potential false pass) |
| `endImpersonation.test.ts` | 11 | Session end, auth | — |
| `setFeatureFlag.test.ts` | 10 | Upsert flag, disable warning, enable no-warning, 401 | No role-check assertions (only session check) |
| `revokeAdmin.test.ts` | 6 | Basic revoke | Last-super-admin protection coverage unclear |
| `getOrganizationBySlug.test.ts` | 27 | Slug lookup, public access | — |
| `listPublicOrgs.test.ts` | 26 | Public listing | — |
| `listAllCommittees.test.ts` | 14 | Cross-org list | — |
| `transitionOrgStatus.test.ts` | 9 | Status transitions | No invalid transition rejection tested |
| Remaining 15 CRUD files | 5-8 each | Basic 401 + happy-path | No sub-role denial, no edge cases |

### Route Protection Tests

- `route-protection-admin.test.ts`: 6 tests covering **3 hand-wired Wave 7 routes** only.
- Generated routes (CRUD on orgs/assocs/flags/admins) have **no route-level middleware tests**.
- Sub-role rejection at the middleware layer is **completely untested**.

### Contract Tests (Hurl)

| Step | What It Tests | Quality |
|---|---|---|
| 0 anon→401 | Auth gate | STRONG (explicit 401 assert) |
| 1-2 sign-in + verify-role | Auth flow + role field | STRONG |
| 3-7 org CRUD + transition | Happy-path org flow | MODERATE (status range only: `>= 200 < 300` or `< 400`) |
| 8-11 assoc CRUD | Happy-path assoc flow | MODERATE (same loose status range) |
| 12-15 admin CRUD | Happy-path operator flow | MODERATE |
| 16-18 flag CRUD | Happy-path flag flow | MODERATE |
| 19 cleanup | Assoc delete | MODERATE |

**Contract test gaps**: No sub-role denial scenarios (no test as analyst or support). No error path assertions (invalid input, duplicate slug, etc.). Status assertions are loose ranges (`>= 200 < 300`) rather than exact codes. No assertion on response body shape beyond `jsonpath "$.data" isCollection` or captured IDs.

---

## 9. Weak Test Report

### W1 — Route protection covers only 3 of ~21 admin routes

`route-protection-admin.test.ts` tests exactly 3 hand-wired Wave 7 routes. All generated CRUD routes for orgs, assocs, flags, and operators have no dedicated middleware-level protection test.

**Risk**: A regression in `platformAdminAuthMiddleware` registration for generated routes would not be caught.

### W2 — E2E spec files use `hasHeading || hasContent` boolean

`admin-routes.spec.ts` (3 tests) passes if *any* heading or `<main>` element is visible. This means a broken page that renders a generic heading would pass.

**Files**: `admin-routes.spec.ts`

### W3 — Admin smoke test asserts on generic text

`admin-smoke.spec.ts` checks for `text=Memberry Admin`. This passes even if the dashboard content fails to load — as long as the sidebar or nav renders that string.

### W4 — Contract test status assertions are loose ranges

Steps 3-19 of `admin-flow.hurl` use `status >= 200 status < 300` (or `< 400`). A 204 response returning an empty body instead of the expected JSON object would pass.

### W5 — Impersonation audit capture test has conditional skip

`startImpersonation.test.ts` test `[BR-10] audit captures both adminId and targetUserId` includes:
```typescript
if (capturedAuditDetails) {
  expect(capturedAuditDetails.adminId)...
} else {
  // Verify the handler at least completed...
}
```
The else branch means the audit assertion can be silently skipped if the mock wiring doesn't capture the call. This is a **false-pass risk** for a security-critical behavior.

### W6 — `revokeAdmin.test.ts` last-super-admin protection unclear

6 assertions is very thin for a critical protection. Without reading the full file it is unclear whether "last super admin" rejection is actually tested or only the happy-path revoke.

### W7 — Wave7-routes.spec.ts stops at heading/selector checks

Does not verify that the national dashboard returns actual aggregated data, that committee counts match the DB, or that the association selector populates from the API.

---

## 10. Missing Test Report

### M1 — Sub-role mutation denial (P1)

**Behaviors**: B11, B12, B13

No test verifies that an `analyst` admin calling `POST /admin/organizations`, `PATCH /admin/organizations/:id`, `DELETE /admin/feature-flags/:id`, or any other mutation endpoint receives a `403`. No test verifies that a `support` admin calling `POST /admin/operators/invite` or `DELETE /admin/operators/:id` receives a `403`.

These permissions are defined in `ac-m03.platform-admin.test.ts` as pure domain rules, but are never asserted at the HTTP handler level or middleware level.

**Required**: Handler-level tests for each mutation endpoint asserting `403` when called with analyst/support context. One middleware unit test for `platformAdminAuthMiddleware` sub-role rejection path.

### M2 — Org status transition UI confirmation (P1)

**Behavior**: B19

No E2E test verifies that the UI presents a confirmation dialog before submitting a status transition. The backend transition is tested (Hurl step 7, transitionOrgStatus unit test), but the frontend confirmation gate is completely untested.

**Risk**: A UI refactor that removes the dialog would not be caught.

### M3 — Full impersonation E2E journey (P1)

**Behavior**: B7 (E2E layer)

No E2E test walks through: sign-in as admin → navigate to `/impersonate` → search for a user → start session → verify impersonation banner → end session. Only a page-load check exists.

### M4 — Feature flag delete confirmation (P2)

**Behavior**: B20

No E2E test verifies the delete confirmation dialog for feature flags. Backend delete is tested; UI confirmation is not.

### M5 — Dashboard quick actions role-filtered (P2)

**Behavior**: B18

No test verifies that analyst-role admins see a read-only dashboard (no create/edit buttons), while super admins see full controls.

### M6 — Route protection for generated CRUD routes

**Behavior**: B1 (extended coverage)

The 3-route `route-protection-admin.test.ts` does not cover generated routes. A table-driven test adding all ~18 remaining CRUD routes is missing.

### M7 — National dashboard data accuracy E2E

**Behavior**: B8 (E2E layer)

No E2E test queries the national dashboard, selects an association, and verifies that displayed metrics match expected aggregated values.

### M8 — Public org lookup E2E

**Behavior**: B16 (E2E layer)

`getOrganizationBySlug.test.ts` and `listPublicOrgs.test.ts` (53 combined unit assertions) are backend-only. No E2E test hits these endpoints from a browser without auth.

### M9 — Frontend component tests (all behaviors)

Zero component-level tests exist for the admin app. No vitest/jest. All UI logic (conditional rendering, form validation, role-based button visibility) is untested below the E2E layer.

### M10 — Accessibility tests

No `axe-core` or similar accessibility assertions anywhere in E2E suite.

---

## 11. CI / Release Gate Readiness

| Gate | Status | Notes |
|---|---|---|
| Bun unit tests in CI | ✅ PASSING | 405 assertions run on every push |
| TypeScript typecheck in CI | ✅ PASSING | Across all workspaces |
| Contract tests (`contract.yml`) | ✅ RUNNING | `admin-flow.hurl` 20 steps against live API |
| E2E tests (`bunx playwright test`) | ⚠️ SCRIPT EXISTS | Not confirmed as required gate; quality is WEAK |
| Sub-role denial coverage | ❌ ABSENT | No CI gate catches analyst calling mutations |
| Frontend component tests | ❌ ABSENT | No CI gate for component-level regressions |
| Accessibility | ❌ ABSENT | No axe/a11y gate |

**Assessment**: CI catches backend regressions reliably. The contract test gate would catch a broken admin auth flow or removed endpoint. However, CI would **not catch** a regression where an analyst gains mutation access, where a required confirmation dialog is removed from the UI, or where the impersonation flow breaks mid-journey. The E2E gate exists but its assertions are too shallow to serve as a meaningful release gate.

---

## 12. Confidence Score

Scoring is 0–10 per layer. 10 = all meaningful behaviors tested with strong assertions. 0 = no tests.

### Layer 1 — Backend Unit / Handler Tests

**Score: 7.5 / 10**

Strong coverage of core CRUD behaviors, impersonation flow, national dashboard aggregation, and BR-36 access control. The 99 + 47 + 25 assertion deep-dives on dashboard and sub-role rules are genuinely thorough. Deductions:
- Sub-role mutation denial (B11/B12) entirely absent at handler level (-1.0)
- Impersonation audit capture has conditional skip risk (-0.5)
- revokeAdmin last-super-admin protection assertion count too thin to be certain (-0.25)
- No invalid-input / validation-failure tests across most CRUD handlers (-0.5)
- Middleware sub-role integration not tested (-0.25)

### Layer 2 — Route Protection / Middleware Tests

**Score: 3.5 / 10**

The 6-test file is correct and meaningful, but covers only 3 of ~21 admin routes. Generated CRUD routes are entirely unprotected at this layer. No sub-role path in `platformAdminAuthMiddleware` is tested. Deductions are severe because the scope of what's covered vs what exists is ~14%.

### Layer 3 — Contract Tests (Hurl)

**Score: 6.0 / 10**

20 Hurl steps provide a genuine happy-path contract harness for the main admin flows. Run in CI via `contract.yml`. Deductions:
- Status assertions use loose ranges instead of exact codes (-1.0)
- No sub-role denial scenarios (-1.5)
- No error path or invalid-input scenarios (-0.75)
- No body-shape assertions beyond collection check (-0.75)

### Layer 4 — E2E / Frontend Tests

**Score: 2.5 / 10**

8 spec files exist but most assertions are page-load-or-heading checks. No test verifies real data from the API. No interaction tests (form submission, confirmation dialogs, role-conditional UI). No component tests at all. Deductions:
- Nearly all tests are WEAK (hasHeading || hasContent pattern) (-3.0)
- No full user journey tested end-to-end (-2.0)
- Zero component test layer (-1.5)
- No role-restricted UI scenario tested (only unauthenticated redirect) (-1.0)

### Overall Confidence

| Layer | Score |
|---|---|
| Backend unit / handler | 7.5 / 10 |
| Route protection / middleware | 3.5 / 10 |
| Contract (Hurl) | 6.0 / 10 |
| E2E / frontend | 2.5 / 10 |
| **Composite (equal weights)** | **4.9 / 10** |

---

## 13. Gate 8 Evaluation

### Gate Result: **FAIL**

The module does not meet the Gate 8 threshold for test confidence. The following issues block gate passage:

#### P1 Blockers (must fix before gate passes)

| Issue | Detail |
|---|---|
| M1: Sub-role mutation denial untested | Analyst calling any mutation endpoint has no test at handler or middleware level. This is a security gap with no CI detection. |
| W5: Audit capture conditional skip | `startImpersonation` BR-10 test silently passes without asserting audit fields. A critical compliance behavior is rubber-stamped. |
| M3: No impersonation E2E journey | The most sensitive admin operation has only a page-load check. |
| M2: Org transition UI confirmation untested | Destructive UI action has no confirmation gate test. |
| M6: Route protection covers <15% of admin routes | CI does not catch middleware regression on generated CRUD routes. |

#### P2 Issues (should fix before production)

| Issue | Detail |
|---|---|
| M4: Feature flag delete confirmation untested | Destructive UI action unverified. |
| M5: Dashboard quick actions role-filtered untested | Analyst could see super-only controls with no test catching it. |
| W4: Loose Hurl status ranges | Contract tests would pass on malformed responses. |
| W3: Smoke test asserts on nav text | Dashboard load assertion is not meaningful. |
| M7: No national dashboard data accuracy E2E | Aggregation correctness only verified in pure domain tests, not integration. |
| M9: Zero frontend component tests | Entire UI logic layer has no automated coverage. |

#### What Passes

- Core backend CRUD behaviors (B3–B10, B14, B16–B17) are tested with adequate unit coverage.
- Auth gate (B1/B2) has multi-layer coverage: unit, contract, E2E.
- National dashboard domain logic (B8/B9) has the strongest test depth in the module (146 combined assertions across two files).
- Impersonation backend logic (B7) is solid minus the audit-capture conditional.
- CI runs backend tests and contract tests on every push.

#### Recommended Remediation (ordered)

1. Fix `startImpersonation.test.ts` audit capture — remove conditional branch, make assertion unconditional.
2. Add handler-level sub-role denial tests for mutation endpoints (analyst → 403, support → 403 on operator endpoints).
3. Add middleware unit test for `platformAdminAuthMiddleware` sub-role rejection path.
4. Expand `route-protection-admin.test.ts` to cover all ~21 admin CRUD routes table-driven.
5. Add E2E test: full impersonation journey (start → banner visible → end).
6. Add E2E test: org status transition confirmation dialog.
7. Tighten Hurl status assertions to exact HTTP codes.
8. Add E2E tests for feature flag delete confirmation and dashboard quick-action role filtering.
9. Evaluate adding vitest component tests for at least the most role-sensitive UI components (dashboard quick actions, impersonation form).
