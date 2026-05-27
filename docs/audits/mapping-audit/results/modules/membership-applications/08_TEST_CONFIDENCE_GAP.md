# 08 — Test Confidence Gap Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## 1. Test Structure Summary

| Test Type | Location | Framework | Count | CI Coverage | Notes |
|-----------|---------|-----------|-------|------------|-------|
| Unit/Integration (Backend) | `services/api-ts/src/handlers/membership/*.test.ts` | Bun test | ~20 files | Yes (bun test) | Most test DEAD handlers, not live ones |
| Unit/Integration (Backend) | `services/api-ts/src/handlers/association:member/*.test.ts` | Bun test | ~40+ files | Yes | Tests live TypeSpec handlers |
| Component (Frontend) | `apps/memberry/src/features/membership/components/*.test.tsx` | Vitest + RTL | 5 files | Yes (vitest) | application-list, category-editor, member-detail, member-table, membership-list |
| Unit (Frontend) | `apps/memberry/src/features/membership/lib/*.test.ts` | Vitest | 1 file | Yes | membership-status |
| Unit (Frontend) | `apps/memberry/src/features/invite/lib/*.test.ts` | Vitest | 1 file | Yes | token-validation |
| E2E | `apps/memberry/tests/e2e/actions/membership-actions.spec.ts` | Playwright | 1 file, ~8 tests | Yes | Roster, detail, suspend, categories |
| E2E (Journey) | `apps/memberry/tests/e2e/journeys/registration-to-payment.spec.ts` | Playwright | 1 file, ~4 tests | Yes | Cross-module, WEAK assertions |

---

## 2. E2E / Playwright Setup Summary

| E2E Tool | Config Found | Local Script | CI Script | Test Location | Status | Gap |
|----------|-------------|-------------|----------|--------------|--------|-----|
| Playwright | `playwright.config.ts` | `bun run test:e2e` | Yes (.github/workflows) | `apps/memberry/tests/e2e/` | Active | No critical infra gap |

---

## 3. Behavior Inventory

| Behavior ID | Behavior/Journey | Type | Role | Source | Criticality | E2E Required? |
|-------------|-----------------|------|------|--------|------------|--------------|
| B-01 | List roster members with filters | UI Interaction + API | officer | MemberTable, GET roster | CRITICAL | Yes |
| B-02 | Approve membership application | Business Rule + API | officer | ApplicationList, POST approve | CRITICAL | Yes |
| B-03 | Deny membership application | Business Rule + API | officer | ApplicationList, POST deny | CRITICAL | Yes |
| B-04 | Bulk approve applications | Business Rule + API | officer | ApplicationList, POST bulk-approve | CRITICAL | Yes |
| B-05 | Add member to roster | State Transition + API | officer | Roster page, POST roster | CRITICAL | Yes |
| B-06 | Suspend member | State Transition + API | officer | MemberDetail, PUT roster/:id | CRITICAL | Yes |
| B-07 | Reinstate member | State Transition + API | officer | MemberDetail, POST reinstate | CRITICAL | Yes |
| B-08 | Terminate/decease member | State Transition + API | officer | MemberDetail, POST decease | IMPORTANT | Yes |
| B-09 | Import members via CSV | Business Rule + API | officer | Import page, POST import | IMPORTANT | Yes |
| B-10 | Manage membership categories | Business Rule + API | officer | CategoryEditor, PUT categories | IMPORTANT | Yes |
| B-11 | Apply for membership | State Transition + API | member | Application form, POST applications | CRITICAL | Yes |
| B-12 | View own memberships | UI Interaction + API | member | MembershipList, GET memberships | IMPORTANT | Yes |
| B-13 | Renew membership (BROKEN) | State Transition | member | MembershipList, no handler | CRITICAL | Yes |
| B-14 | Update org profile (president) | Business Rule + API | president | Org profile form, PUT org-profile | IMPORTANT | Yes |
| B-15 | Accept invite (validate→claim) | Cross-Module Journey | unauthed→member | Invite flow | CRITICAL | Yes |
| B-16 | Only association:admin can manage roster | Permission Rule | officer | authMiddleware roles | CRITICAL | No (API test) |
| B-17 | Only PRESIDENT can update org profile | Permission Rule | president | requirePosition | CRITICAL | No (API test) |
| B-18 | BR-01: Computed membership status | Business Rule | all | computeMembershipStatus | CRITICAL | No (unit) |
| B-19 | BR-02: Grace period from dues config | Business Rule | system | reviewApplication, addMember | CRITICAL | No (unit) |
| B-20 | BR-22: Cross-org matching on import | Business Rule | officer | csvImport findPersonMatch | IMPORTANT | No (unit) |
| B-21 | Grace-to-lapsed job | Business Rule | system | graceToLapsed job | CRITICAL | No (integration) |

---

## 4. Behavior-to-Test Matrix

| Behavior/Journey | Role | Source | Existing Test | Test Type | Assertion Quality | Missing Coverage | Severity |
|-----------------|------|--------|--------------|-----------|------------------|-----------------|----------|
| B-01: List roster | officer | MemberTable | `membership-actions.spec.ts` — "roster shows real member data" | E2E | STRONG — checks names, status, member numbers | Category filter, dues status filter | P2 |
| B-02: Approve application | officer | ApplicationList | `approveMembershipApplication.test.ts` | Backend unit | STRONG — checks status change, membership creation | No E2E, no role denial test | P1 |
| B-03: Deny application | officer | ApplicationList | `denyMembershipApplication.test.ts` | Backend unit | STRONG — checks status, reason stored | No E2E, no role denial test | P1 |
| B-04: Bulk approve | officer | ApplicationList | `bulkApproveMembershipApplications.test.ts` | Backend unit | `[NEEDS MANUAL CONFIRMATION]` | No E2E, partial failure test | P1 |
| B-05: Add member | officer | Roster | `addMember.test.ts` (DEAD handler) | Backend unit | STRONG — checks 201, orgId, createdBy | Tests dead handler, not live; no E2E | P1 |
| B-06: Suspend member | officer | MemberDetail | `membership-actions.spec.ts` — "suspend action changes status" | E2E | STRONG — clicks suspend, checks status changes | — | — |
| B-07: Reinstate member | officer | MemberDetail | None found | — | NONE | No test at all | P1 |
| B-08: Terminate/decease | officer | MemberDetail | None found | — | NONE | No test at all | P1 |
| B-09: CSV import | officer | Import page | `csvImport.test.ts`, `importMembers.test.ts` | Backend unit | STRONG — per-row validation, conflict handling | No E2E (render only) | P1 |
| B-10: Manage categories | officer | CategoryEditor | `upsertCategory.test.ts` (DEAD handler), `category-editor.test.tsx` | Backend + Component | Component: `[NEEDS MANUAL CONFIRMATION]`; Backend: STRONG | Schema drift test, E2E | P1 |
| B-11: Apply for membership | member | Application form | `flow-03.application-membership.test.ts` | Backend integration | STRONG — full flow | No E2E | P1 |
| B-12: View memberships | member | MembershipList | `membership-list.test.tsx` | Component | `[NEEDS MANUAL CONFIRMATION]` | E2E | P2 |
| B-13: Renew (BROKEN) | member | MembershipList | None | — | NONE | Button dead — no handler | P2 |
| B-14: Update org profile | president | Org profile | `updateOrgProfile.test.ts` | Backend unit | STRONG — checks requirePosition | No position denial test, no E2E | P1 |
| B-15: Accept invite | unauthed | Invite flow | `createInvite.test.ts`, `validateInvite.test.ts`, `claimInvite.test.ts` | Backend unit | STRONG per handler | No E2E journey | P1 |
| B-16: Admin-only roster | officer | authMiddleware | None (role denial) | — | NONE | No deny test | P1 |
| B-17: President-only profile | president | requirePosition | Tested in updateOrgProfile.test.ts (partial) | Backend | WEAK — tests `requirePosition` mock | No real role denial test | P1 |
| B-18: Computed status | all | computeMembershipStatus | `membership-status.test.ts` | Frontend unit | STRONG | — | — |
| B-19: Grace period | system | reviewApplication | `reviewApplication.test.ts` (DEAD handler) | Backend unit | STRONG — checks DuesConfigRepository | Tests dead handler | P2 |
| B-20: Cross-org matching | officer | csvImport | `csvImport.test.ts` | Backend unit | STRONG | — | — |
| B-21: Grace-to-lapsed job | system | graceToLapsed | `graceToLapsed.test.ts` | Backend unit | `[NEEDS MANUAL CONFIRMATION]` | — | P2 |

---

## 5. E2E Journey Coverage Matrix

| Module/Area | Journey/Nav Path | Existing E2E Test | Coverage Quality | Missing Assertions | Recommended E2E Test | Severity |
|-------------|-----------------|------------------|-----------------|-------------------|--------------------|----|
| Membership | Roster view + filter | `membership-actions.spec.ts` | STRONG | Category filter, dues status | — | P2 |
| Membership | Member detail + suspend | `membership-actions.spec.ts` | STRONG | Reinstate after suspend | Reinstate flow | P2 |
| Membership | Application approve/deny | None | NONE `[E2E GAP]` | Full approve/deny flow | `test('approve application → status changes')` | P1 |
| Membership | Bulk approve | None | NONE `[E2E GAP]` | Select + bulk + verify | `test('bulk approve → all status change')` | P1 |
| Membership | Add member | None | NONE `[E2E GAP]` | Form → submit → roster | `test('add member → appears in roster')` | P1 |
| Membership | CSV import | `membership-actions.spec.ts` | WEAK (render only) | Upload→preview→import→verify | `test('import CSV → members in roster')` | P1 |
| Membership | Terminate/decease | None | NONE `[E2E GAP]` | Dialog → confirm → status | `test('terminate member → status removed')` | P1 |
| Membership | Categories | `membership-actions.spec.ts` | WEAK (render only) | Add → save → table | `test('add category → appears in table')` | P2 |
| Membership | Invite flow | None | NONE `[E2E GAP]` | Validate → auth → claim | `test('invite → claim → org member')` | P1 |
| Membership | Registration→Payment | `registration-to-payment.spec.ts` | WEAK | Real application submit, data verification | Strengthen assertions | P1 |

---

## 6. Role and Permission Test Matrix

| Route/API/Journey | Role | Allow Test | Deny Test | Unauthenticated Test | Ownership Test | E2E Test | Gap | Severity |
|------------------|------|-----------|-----------|---------------------|---------------|---------|-----|----------|
| `GET /association/member/roster` | association:admin | None (dead handler test) | None | None | None | E2E: implied | Allow + deny tests for live handler | P1 |
| `POST /.../applications/:id/approve` | association:admin | Backend test | None | None | None | None | Deny test, E2E | P1 |
| `POST /.../applications/:id/deny` | association:admin | Backend test | None | None | None | None | Deny test, E2E | P1 |
| `PUT /membership/org-profile/:orgId` | PRESIDENT | Backend test (mock) | None | None | None | None | Real position denial test | P1 |
| `POST /invite` | officer+orgContext | Backend test | None | None | N/A | None | Deny: no org context, no auth | P2 |
| `GET /invite/validate/:token` | unauthenticated | Backend test | N/A (public) | Implicit | N/A | None | E2E | P2 |

---

## 7. Frontend Journey Test Matrix

| Journey/Interaction | Existing Test | Existing E2E | Missing State/Path | Recommended Test Type | Severity |
|-------------------|--------------|-------------|-------------------|---------------------|----------|
| Roster load + filter | Component: member-table.test.tsx | E2E: STRONG | Error state, empty with filter | Component | P3 |
| Application approve | None | None | Happy path, error handling, loading | E2E + Component | P1 |
| Application deny | None | None | Happy path, reason validation | E2E + Component | P1 |
| Bulk approve | None | None | Select all, partial failure, zero selection | E2E + Component | P1 |
| Category add form | Component: category-editor.test.tsx | None | Validation, duplicate name | Component + E2E | P2 |
| CSV upload + parse | None | WEAK | File format error, large file, empty CSV | E2E | P1 |
| Member suspend dialog | None | E2E: STRONG | Empty reason blocked | — | — |
| Member terminate | None | None | Full flow | E2E | P1 |
| License verify | None | None | Verify click → status change | Component + E2E | P2 |

---

## 8. API and Backend Test Matrix

| API/Backend Behavior | Existing Test | Assertion Quality | Missing Coverage | Recommended Test Type | Severity |
|---------------------|--------------|------------------|-----------------|---------------------|----------|
| `POST /association/member/roster` (addRosterMember) | `addMember.test.ts` — tests DEAD handler | STRONG (dead) | Live handler test, role deny | API/integration | P1 |
| `PUT /association/member/roster/:id` (updateRosterMember) | `updateMember.test.ts` — tests DEAD handler | STRONG (dead) | Live handler test, status transition validation | API/integration | P1 |
| `GET /association/member/roster` (listRosterMembers) | `listOrgMembers.test.ts` — tests DEAD handler | STRONG (dead) | Live handler test, pagination, filters | API/integration | P1 |
| `POST /.../applications/:id/approve` | `approveMembershipApplication.test.ts` | STRONG | Role deny, already-approved handling | API/integration | P1 |
| `POST /.../applications/:id/deny` | `denyMembershipApplication.test.ts` | STRONG | Role deny, empty reason | API/integration | P1 |
| `POST /.../applications/bulk-approve` | `bulkApproveMembershipApplications.test.ts` | `[NEEDS MANUAL CONFIRMATION]` | Partial failure, empty array | API/integration | P1 |
| `PUT /.../membership-categories/:orgId` | `upsertCategory.test.ts` — tests DEAD handler | STRONG (dead) | Live handler test with extra fields | API/integration | P1 |
| `POST /association/member/roster/import` | `importMembers.test.ts`, `csvImport.test.ts` | STRONG | Dead handler `requirePosition` test; live handler needs its own | API/integration | P1 |
| `PUT /membership/org-profile/:orgId` | `updateOrgProfile.test.ts` | STRONG | Non-president deny test (real, not mock) | API/integration | P1 |
| `POST /invite` | `createInvite.test.ts` | STRONG | Duplicate invite, invalid email | API/integration | P2 |
| `POST /invite/claim/:token` | `claimInvite.test.ts` | `[NEEDS MANUAL CONFIRMATION]` | Expired token, already-claimed | API/integration | P2 |
| Grace-to-lapsed job | `graceToLapsed.test.ts` | `[NEEDS MANUAL CONFIRMATION]` | Edge cases: exactly at boundary | Unit | P2 |

---

## 9. Weak Test Report

| Test File | Weak Pattern | Why It Is Weak | Recommended Improvement | Severity |
|-----------|-------------|---------------|----------------------|----------|
| `membership-actions.spec.ts` — import test | Page-load-only assertion | `expect(page.getByText(/Import Roster|Drop CSV/i)).toBeVisible()` — only checks render | Add: upload file → preview → import → verify roster | P1 |
| `membership-actions.spec.ts` — applications test | Empty state only assertion | `expect(page.getByText(/no applications/i)).toBeVisible()` — no data-driven test | Add: seed application → approve/deny → verify | P1 |
| `membership-actions.spec.ts` — categories test | Render-only assertion | Checks text visible but no add/save/deactivate action | Add: add category → verify in table | P2 |
| `registration-to-payment.spec.ts` — all tests | Generic text match assertions | Uses `toMatch(/dashboard|onboarding|my|auth/)` and `toBeTruthy()` — no specific data verification | Strengthen: verify specific data states after each step | P1 |
| `addMember.test.ts` | Tests dead handler | Tests `membership/addMember.ts` which is not registered to any route | Redirect test coverage to live `association:member` handler | P1 |
| `reviewApplication.test.ts` | Tests dead handler | Tests `membership/reviewApplication.ts` which is not registered | Redirect to live approve/deny handlers | P1 |
| `upsertCategory.test.ts` | Tests dead handler | Tests `membership/upsertCategory.ts` which is not registered | Redirect to live `association:member` handler | P1 |
| `listOrgMembers.test.ts` | Tests handler of uncertain liveness | Handler imported by registry but route registration `[NEEDS MANUAL CONFIRMATION]` | Verify route exists; if dead, redirect tests | P2 |

---

## 10. Missing Test Report

| Item | Risk | Recommended Test Type | Suggested Assertion | Priority |
|------|------|--------------------|-------------------|----------|
| Application approve E2E journey | Officer can't verify approval works end-to-end | E2E | Navigate→approve→toast success→status = Approved | P0 |
| Application deny E2E journey | Officer can't verify denial works | E2E | Navigate→deny with reason→status = Denied | P1 |
| Role deny: user calls admin-only endpoints | Auth bypass not tested | API/integration | `expect(response.status).toBe(403)` | P1 |
| Position deny: non-president calls updateOrgProfile | Position bypass not tested | API/integration | `expect(response.status).toBe(403)` | P1 |
| CSV import full E2E | Bulk import may fail silently | E2E | Upload→preview→import→new members in roster | P1 |
| Invite full E2E journey | Onboarding path untested | E2E | Validate→auth→claim→member of org | P1 |
| Terminate member E2E | Destructive action untested | E2E | Terminate→status = removed | P1 |
| Reinstate member | No test at all | API + E2E | Reinstate→status = active | P1 |
| Live handler coverage for roster CRUD | Dead handler tests give false confidence | API/integration | Port assertions to live handler tests | P1 |
| Category schema drift | Frontend sends fields not in TypeSpec | Integration | POST with extra fields → verify behavior | P1 |

---

## 11. CI / Release Gate Readiness

| Gate | Present? | Command/Config | Covers Module? | Gap | Severity |
|------|---------|---------------|---------------|-----|----------|
| Lint | Yes | `eslint` | Yes | — | — |
| Typecheck | Yes | `tsc --noEmit` | Yes | Category editor has type-casts | P3 |
| Unit tests (backend) | Yes | `bun test` | Partially — many test dead handlers | Dead handler tests pass but don't test live code | P1 |
| Component tests (frontend) | Yes | `vitest` | Yes — 6 test files | — | — |
| E2E tests | Yes | `playwright test` | Partially — 2 spec files | Many critical journeys have no E2E | P1 |
| Build | Yes | `bun run build` | Yes | — | — |
| Coverage report | No | — | — | No coverage metrics | P3 |

---

## 12. Confidence Score

| Layer | Score / 10 | Main Gap | Evidence |
|-------|-----------|---------|---------|
| Coverage Integrity | 4/10 | Many tests cover dead handlers, not live ones. Critical journeys (approve, deny, add member, import) lack E2E | 8+ dead handler test files, 6 E2E NONE gaps |
| Behavior Traceability | 5/10 | Most behaviors have SOME test but mapping to live code is unreliable due to dead handler confusion | 21 behaviors identified, ~12 have existing tests (many against dead handlers) |
| Test Quality | 6/10 | Backend tests are STRONG when they exist, but E2E tests are often WEAK (render-only, text-match) | membership-actions has STRONG suspend test, WEAK import/categories/applications |
| Release Gate Readiness | 5/10 | CI runs tests but dead handler tests create false confidence; critical E2E gaps mean regressions can ship | CI passes but doesn't catch approve/deny/import/invite regressions |

**Overall Confidence: 5/10**

---

## 13. Gate 8 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 8 | Membership/Applications | **PASS** | Test framework detected, E2E detected, behavior inventory (21 items), behavior-to-test mapping complete, STRONG/WEAK/NONE classification done, missing tests listed (10 items), E2E gaps identified (8), CI gates checked | None blocking — findings are audit results, not blockers |

---

## Critical Finding Summary

### P0 Findings (0 new for this module)

No new P0 findings. TypeSpec routes have proper `authMiddleware({ roles: ["association:admin"] })`.

### P1 Findings (12)

1. **Dead handler false confidence** — 8 backend test files test handlers not connected to routes. CI passes, giving false security.
2. **No E2E for application approve/deny** — critical officer workflow completely untested end-to-end.
3. **No E2E for bulk approve** — multi-record state change untested.
4. **No E2E for add member** — core roster operation untested.
5. **No E2E for CSV import journey** — only render check exists.
6. **No E2E for terminate/decease** — destructive action untested.
7. **No E2E for invite flow** — onboarding path untested.
8. **No role denial tests** — no test verifies that `user` role is blocked from admin endpoints.
9. **No position denial test** — non-president calling `updateOrgProfile` untested.
10. **Category schema drift** — frontend sends 5 fields not in TypeSpec; no integration test.
11. **Registration-to-payment E2E is WEAK** — generic assertions don't verify real data.
12. **Reinstate member completely untested** — no backend or E2E test.

### P2 Findings (7)

1. Renew button dead (no handler)
2. Bulk approve uses raw fetch, not SDK
3. License verify uses raw api.patch
4. Extended query params (duesStatus, trainingCompliant) not in SDK types
5. getOrgProfile allows any auth user to read any org
6. No E2E for category add/deactivate flow
7. No E2E for member directory page
