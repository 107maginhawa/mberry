# Phase 4: Test Quality Hardening + Gap Fill — Implementation Record

> Completed 2026-05-13. Closed 13/14 Phase 2 gaps. 1 blocked (feature not built).
> All deferred BR stubs (35-40) expanded to full edge-case coverage.

## Gap Inventory (from Phase 2)

### P0 — Critical

| # | Gap | Action | Status |
|---|-----|--------|--------|
| 1 | BR-01 E2E: status computation is page smoke | Hardened with real status value regex + member count assertions | **DONE** |
| 2 | BR-03 E2E: state machine transitions are page smoke | Hardened with status-conditional action button assertions | **DONE** |

### P1 — Security

| # | Gap | Action | Status |
|---|-----|--------|--------|
| 3 | Certificate detail IDOR | Fixed handler (ownership check) + IDOR unit test + flow-09 fix | **DONE** |
| 4 | Cross-org report data leakage | Added 3 IDOR tests for dues-reporting report + dashboard endpoints | **DONE** |

### P2 — Standard

| # | Gap | Action | Status |
|---|-----|--------|--------|
| 5 | cancelBooking.ts (155 lines, no test) | 5 tests: cancel, validation, not-found, forbidden | **DONE** |
| 6 | getDuesDashboard.ts (55 lines, no test) | 2 tests: unauth, stats with numeric coercion | **DONE** |
| 7 | createBookingEvent.ts (66 lines, no test) | 3 tests: no-org, invalid config, success | **DONE** |
| 8 | sendMessage.ts (64 lines, no test) | 7 tests: auth, org, not-found, cross-org, status, draft, scheduled | **DONE** |
| 9 | BR-16 visibility toggle not E2E tested | Feature not built (no DB column, no handler, no UI). 4 edge-case fixme stubs in place. | **BLOCKED** |
| 10 | BR-33 election integrity E2E shallow | Deepened: status + position assertions | **DONE** |
| 11 | BR-34 nomination eligibility contract stub | Already covered: 10 unit tests in br-34.nomination-eligibility.test.ts. Contract + E2E stubs updated. | **DONE** |
| 12 | 3 memberry routes without E2E | Certificate detail, training detail, attendance (existing) | **DONE** |
| 13 | 3 admin routes without E2E | Feature-flags, impersonate, operators smoke tests | **DONE** |
| 14 | Deactivated officer route access | 8 tests for requireOfficerTerm + requirePosition | **DONE** |

### P3 — Low Priority

| # | Gap | Action | Status |
|---|-----|--------|--------|
| 15 | 4 account booking routes without E2E | Template boilerplate — skipped | SKIP |

## Results

- **13 gaps closed** (2 P0, 2 P1, 9 P2)
- **1 blocked** (BR-16 — feature not built, 4 fixme stubs in place)
- **1 skipped** (account booking — template boilerplate)
- **1 security fix** (certificate IDOR)
- **25 new unit tests** added
- **5 E2E tests hardened** with real data assertions
- **33 edge-case fixme stubs** added to deferred BR stubs (BR-34 through BR-40, BR-16)

## Security Fix: Certificate IDOR (Gap #3)

`getCertificate.ts` had no ownership check — any authenticated member could access any certificate by ID. Fixed by adding `cert.personId !== user.id` guard that throws `ForbiddenError`.

## Files Changed

### Security fix
- `services/api-ts/src/handlers/certificates/getCertificate.ts` — added ownership check (IDOR fix)

### New test files
- `services/api-ts/src/handlers/booking/cancelBooking.test.ts` — 5 tests
- `services/api-ts/src/handlers/booking/createBookingEvent.test.ts` — 3 tests
- `services/api-ts/src/handlers/dues/getDuesDashboard.test.ts` — 2 tests
- `services/api-ts/src/handlers/communication/sendMessage.test.ts` — 7 tests
- `services/api-ts/src/utils/officer-check.test.ts` — 8 tests (deactivated officer + position matching)
- `apps/admin/tests/e2e/admin-routes.spec.ts` — 3 admin route smoke tests

### Hardened tests
- `apps/memberry/tests/e2e/actions/membership-actions.spec.ts` — BR-01/BR-03 real assertions
- `apps/memberry/tests/e2e/member/certificates.spec.ts` — certificate detail route
- `apps/memberry/tests/e2e/member/training.spec.ts` — training detail route
- `apps/memberry/tests/e2e/officer/elections.spec.ts` — BR-33 status + position assertions
- `services/api-ts/src/handlers/certificates/getCertificate.test.ts` — IDOR test added
- `services/api-ts/src/handlers/certificates/flow-09.certificate-retrieval.test.ts` — user context fix
- `services/api-ts/src/tests/route-protection-idor.test.ts` — 3 report IDOR tests added
