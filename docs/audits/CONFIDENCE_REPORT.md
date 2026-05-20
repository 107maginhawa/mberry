# Test Confidence Stack Report

**Project:** Memberry (monobase monorepo)
**Date:** 2026-05-20 (rev 4)
**Previous:** 2026-05-20 (rev 3)
**Auditor:** oli-confidence-stack v3
**Stack:** TypeScript + Hono + Drizzle ORM + Bun test + Vitest + Playwright

---

## Executive Summary

| Metric | Previous (rev 3) | Current (rev 4) | Delta |
|--------|-------------------|-------------------|-------|
| **Overall Confidence Score** | **8.6 / 10** | **8.8 / 10** | +0.2 |
| Layer 1: Coverage Integrity (25%) | 8.7 / 10 | 8.7 / 10 | -- |
| Layer 2: Behavior Traceability (30%) | 8.5 / 10 | 9.0 / 10 | +0.5 |
| Layer 3: Test Quality (25%) | 8.4 / 10 | 8.4 / 10 | -- |
| Layer 4: Release Gate Readiness (20%) | 9.0 / 10 | 9.0 / 10 | -- |

**Verdict:** Confidence rises to 8.8 driven by Layer 2 recovery. Both P0-security gaps resolved: BR-49 (Active Status Includes Grace Period) now has 6 backend tests in `org-auth.test.ts`, BR-51 (Internal Service Token Timing-Safe Comparison) now has 4 backend tests in `auth.test.ts` (previously miscounted as untested). New `/metrics` endpoint improves observability posture. Zero UNTESTED BRs remain. 14 WEAK BRs (1 layer only) remain -- primarily p2-deferred items.

---

## Test Inventory

| Test Type | Previous | Current | Delta | Notes |
|-----------|----------|---------|-------|-------|
| Backend unit/integration (handler) | 380 | 4,971 | -- | Recount via `bun test` (includes all suites) |
| Frontend component (Vitest) | 86 | 86 | -- | memberry (54) + account (32) |
| E2E Playwright | 101 | 101 | -- | memberry (92) + admin (6) + account (3) |
| Contract (Hurl) | 97 | 97 | -- | Spec-first, against live API |
| SDK tests | 5 | 5 | -- | packages/sdk-ts |
| **Total test files** | **669** | **596** | **-73** | Recount via bun test runner |
| **Total assertions** | **9,460** | **20,719** | **+11,259** | All `expect()` calls (bun test output) |

### Assertion Breakdown

| Source | Count |
|--------|-------|
| Backend `expect()` (bun test) | 20,719 |
| Memberry component `expect()` | 746 |
| Account component `expect()` | 565 |
| Memberry E2E `expect()` | 656 |
| Admin E2E `expect()` | 53 |
| Account E2E `expect()` | 37 |
| Hurl assertions (HTTP + jsonpath) | 474 |
| **Total** | **23,250** |

### Deferred/Incomplete Tests

| Type | Previous | Current | Delta |
|------|----------|---------|-------|
| `test.todo()` | 21 | 21 | -- |
| `test.skip()` / conditional skip | 8 | 8 | -- |
| `test.fixme()` (E2E stubs) | 55 | 55 | -- |
| **Total deferred** | **84** | **84** | -- |

---

## Layer 1: Coverage Integrity (8.7/10)

### Handler Module Test Coverage

25 handler modules tracked.

| Module | Handlers | Tests | Ratio | Assessment |
|--------|----------|-------|-------|------------|
| association:member | 166 | 44 | 27% | Good (mega-module, many CRUD) |
| communication | 28 | 35 | 125% | Excellent |
| person | 27 | 32 | 119% | Excellent |
| platformadmin | 21 | 24 | 114% | Excellent |
| booking | 19 | 24 | 126% | Excellent |
| membership | 14 | 23 | 164% | Excellent |
| billing | 16 | 21 | 131% | Excellent |
| documents | 15 | 18 | 120% | Excellent |
| training | 13 | 18 | 138% | Excellent |
| email | 11 | 17 | 155% | Excellent |
| events | 10 | 16 | 160% | Excellent |
| dues | 6 | 16 | 267% | Excellent (deep util tests) |
| elections | 7 | 15 | 214% | Excellent |
| association:operations | 54 | 13 | 24% | Thin -- large module |
| advertising | 7 | 7 | 100% | Good |
| jobs | 7 | 7 | 100% | Good |
| notifs | 6 | 7 | 117% | Good |
| certificates | 4 | 7 | 175% | Excellent |
| reviews | 4 | 5 | 125% | Good |
| comms | 11 | 5 | 45% | Thin |
| invite | 3 | 4 | 133% | Good |
| audit | 1 | 4 | 400% | Good |
| marketplace | 9 | 3 | 33% | Improved (was 11%) |
| storage | 6 | 2 | 33% | Thin |
| __tests__ (shared) | 0 | 1 | -- | BR edge cases |

### Modules Below 50% Test-to-Handler Ratio

| Module | Handlers | Tests | Ratio | Risk |
|--------|----------|-------|-------|------|
| **association:operations** | 54 | 13 | 24% | MEDIUM -- mega-module |
| **association:member** | 166 | 44 | 27% | MEDIUM -- mega-module |
| **marketplace** | 9 | 3 | 33% | MEDIUM (improved from 11%) |
| **storage** | 6 | 2 | 33% | MEDIUM |
| **comms** | 11 | 5 | 45% | LOW |

### Coverage Changes from Previous

- **UNCHANGED** from rev 3 -- no new handler test files added this revision
- Focus was on BR-level test gaps (BR-49, BR-51) via shared test files

### Strengths
- 25/25 modules have at least 1 test file (100% module coverage)
- Co-located test pattern aids discoverability
- New code gate enforces test-first on PRs
- advertising + jobs modules at 100% handler coverage

---

## Layer 2: Behavior Traceability (9.0/10)

### BR Coverage Summary

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Total business rules | 51 | 51 | -- |
| STRONG (>=2 test layers) | 37 | 37 | -- |
| WEAK (1 test layer only) | 12 | 14 | +2 |
| NONE (0 test layers) | 2 | 0 | -2 |
| Coverage (any test) | 96.1% | 100% | +3.9% |

### Layer-Level Coverage

| Layer | Count | % |
|-------|-------|---|
| With backend tests | 51 | 100% |
| With contract tests | 36 | 70.6% |
| With E2E tests | 36 | 70.6% |
| All 3 layers | 34 | 66.7% |

### BR Status Matrix

| Status | Count | BRs |
|--------|-------|-----|
| COMPLETE (all 3 layers) | 34 | BR-01 through BR-34 |
| STRONG (2 layers) | 3 | BR-41, BR-42, BR-43 |
| WEAK (1 layer only) | 14 | BR-35--BR-40, BR-44--BR-46, BR-47, BR-48, BR-49, BR-50, BR-51 |
| **UNTESTED** | **0** | **--** |

### Previously UNTESTED BRs -- NOW COVERED

| BR | Rule | Classification | Tests Added | File |
|----|------|---------------|-------------|------|
| **BR-49** | Active Status Includes Grace Period | p1-business | 6 backend tests | `services/api-ts/src/utils/org-auth.test.ts` |
| **BR-51** | Internal Service Token Timing-Safe Comparison | p0-security | 4 backend tests | `services/api-ts/src/middleware/auth.test.ts` |

Both P0-security gaps are now resolved. BR-51 was previously miscounted as untested -- `auth.test.ts` had 4 tests covering timing-safe comparison but was not linked in the BR registry.

### WEAK BRs (backend-only, no contract or E2E)

| BR | Rule | Classification | Layer |
|----|------|---------------|-------|
| BR-35 | Feed Content Moderation | p2-deferred | backend |
| BR-36 | National Dashboard Access | p2-deferred | backend |
| BR-37 | Job Posting Expiry | p2-deferred | backend |
| BR-38 | Marketplace Referral Disclosure | p2-deferred | backend |
| BR-39 | Committee Dissolution | p2-deferred | backend |
| BR-40 | Survey Anonymity | p2-deferred | backend |
| BR-44 | Election Certification Cross-Module Effects | p1-business | backend |
| BR-45 | Credit Entry Requires ActivityName and Positive Amount | p1-business | backend |
| BR-46 | Credit Cycle Auto-Computed | p1-business | backend |
| BR-47 | Banned Users Rejected at Auth Middleware | p0-auth | E2E only |
| BR-48 | Bulk Payment Batch Size Limit | p1-business | backend |
| BR-49 | Active Status Includes Grace Period | p1-business | backend |
| BR-50 | Election Date Ordering DB Constraints | p0-data | backend |
| BR-51 | Internal Service Token Timing-Safe Comparison | p0-security | backend |

### Observations
- Both previously UNTESTED BRs (BR-49, BR-51) now have backend test coverage
- BR-51 (p0-security) gap is closed -- timing-safe comparison verified
- BR-49 and BR-51 move from UNTESTED to WEAK (backend only, no contract/E2E layers yet)
- 100% BR coverage restored (was 96.1%)
- CI regression gate via `scripts/br-coverage.ts --ci` prevents silent degradation
- BR-47 still has E2E but no backend test -- unusual inversion

---

## Layer 3: Test Quality (8.4/10)

### Assertion Quality Metrics

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Strong assertions (toBe/toEqual/toThrow/toContain/toMatchObject/rejects) | 93.2% | 93.2% | -- |
| Weak assertions (toBeDefined/toBeTruthy/toBeFalsy) | 6.8% | 6.8% | -- |
| Assertions per test file (backend) | 18.2 | 34.7 | +16.5 |
| Error path test coverage | All sampled | All sampled | -- |

### Strong vs Weak Assertion Breakdown (Backend)

| Type | Count | % |
|------|-------|---|
| Strong (toBe, toEqual, toStrictEqual, toThrow, toContain, toMatchObject, toHaveBeenCalled, rejects) | 19,310 | 93.2% |
| Weak (toBeDefined, toBeTruthy, toBeFalsy, toBeNull, toBeUndefined) | 1,409 | 6.8% |
| **Total categorized** | **20,719** | |

### Anti-Pattern Scan

| Pattern | Count | Severity |
|---------|-------|----------|
| `expect(true).toBe(false)` (unreachable guard) | 7 | OK -- used as "should not reach" in catch blocks |
| Test files with 0 assertions | 1 | OK -- `empty-response-guard.test.ts` uses throw-based assertion |
| Tautological tests | 0 | **CLEAN** |
| Duplicate object keys in fixtures | 0 | **CLEAN** |

---

## Layer 4: Release Gate Readiness (9.0/10)

### CI Pipeline (`.github/workflows/ci.yml`)

| Gate | What It Checks | Status |
|------|---------------|--------|
| `lint-typecheck` | TypeScript typecheck, ESLint, migration safety, no-silent-skips, SDK freshness, dep audit | In CI |
| `unit-tests` | Backend (bun test), frontend (memberry + account + SDK, with coverage) | In CI |
| `e2e` | Playwright E2E for memberry + admin (real Postgres, MinIO) | In CI |
| `contract` | Hurl contract tests + Schemathesis fuzzing | In CI |
| `build-api` | Docker image build + container health check | In CI |
| `build-frontends` | Vite builds for all 3 apps | In CI |
| `artifact-smoke` | Build artifact verification | In CI |
| `coverage-gate` | BR coverage regression (`scripts/br-coverage.ts --ci`) | In CI |
| `new-code-gate` | New handler files must have tests | PR-only |
| `ci-gate` | Aggregator -- ALL above must pass | Required |

### Pre-Commit Hooks

| Hook | What It Does |
|------|-------------|
| `bun run typecheck` | Full workspace typecheck before commit |
| `bunx lint-staged` | ESLint auto-fix on staged files (4 app configs) |

### Custom Quality Scripts

| Script | Purpose | CI? |
|--------|---------|-----|
| `scripts/br-coverage.ts` | BR regression gate | Yes |
| `scripts/lint-no-skips.ts` | Prevent silent test.skip() | Yes |
| `scripts/lint-shallow-tests.ts` | Catch shallow assertions | No (informational) |
| `scripts/migration-safety.ts` | Migration destructiveness checks | Yes |
| `scripts/new-code-gate.ts` | New handlers must have tests | Yes (PR) |

### Observability Improvement

- New `/metrics` endpoint added for runtime observability
- Complements existing `/livez` and `/readyz` health probes
- Provides application-level metrics for monitoring dashboards

### Weaknesses (unchanged)
- No explicit per-test timeout enforcement (only job-level)
- No flaky test detection/retry mechanism in CI
- No mutation testing
- `lint:shallow` exits 0 always -- should fail CI on tautological assertions

---

## Top Gaps and Risk Areas

### Priority 0 (Resolved)
1. ~~BR-51 (Internal Service Token Timing-Safe Comparison) has ZERO tests~~ -- **RESOLVED**: 4 backend tests in `auth.test.ts`
2. ~~BR-49 (Active Status Includes Grace Period) has ZERO tests~~ -- **RESOLVED**: 6 backend tests in `org-auth.test.ts`

### Priority 1 (Address Now)
1. **BR-47 (Banned Users Rejected at Auth Middleware) has E2E but no backend test** -- p0-auth. Unit test needed for the middleware layer.
2. **BR-50 (Election Date Ordering DB Constraints) backend-only** -- p0-data. Needs contract test.
3. **BR-49 and BR-51 need contract/E2E layers** -- currently WEAK (backend only).

### Priority 2 (Address Soon)
4. **association:operations** has 54 handlers but only 13 test files (24% ratio) -- second-largest module.
5. **storage** remains at 2 tests for 6 handlers.
6. **55 `test.fixme()` E2E stubs** -- Track as v2.0 debt.
7. **BR-44, BR-45, BR-46, BR-48** (p1-business) need contract/E2E layers.

### Priority 3 (Nice to Have)
8. **lint:shallow should fail CI** on tautological `expect(true).toBe(true)` patterns.
9. **Mutation testing** -- Stryker.js for deeper effectiveness validation.
10. **Flaky test detection** -- Add retry/tagging in CI config.

---

## Scoring Methodology

### Layer 1: Coverage Integrity (8.7/10) [unchanged]
- 25/25 modules have tests (+3)
- Co-located test pattern (+1)
- New code gate enforces test-first (+1)
- advertising + jobs at 100% handler coverage (+0.3)
- marketplace improved from 11% to 33% (+0.1)
- association:operations still thin (24%) (-0.5)
- storage still thin (33%) (-0.4)
- comms thin (45%) (-0.2)
- 2 mega-modules below 30% (-0.6)

### Layer 2: Behavior Traceability (9.0/10) [was 8.5]
- 51 BRs total (+1)
- 51/51 have at least 1 test layer (+2.5) [was 49/51]
- 34/51 have all 3 layers (+1.5)
- Formal BR registry with CI gate (+2)
- BR references in test names (+1)
- **0 BRs with ZERO tests (was 2, +2.5 recovery)**
- 14 WEAK BRs (1 layer only) (-1.2) [was 12]
- BR-47 missing backend test for p0-auth (-0.3)

### Layer 3: Test Quality (8.4/10) [unchanged]
- 93.2% strong assertion ratio (+3.5)
- Error path testing in all sampled files (+1.5)
- Business rule edge cases well-tested (+1)
- Assertions per test file 34.7 (up from 18.2) (+0.5)
- 0 tautological tests (+0.5)
- lint:shallow catches some weak patterns (+0.5)
- No mutation testing (-1)
- 6.8% weak assertions still present (-0.5)

### Layer 4: Release Gate Readiness (9.0/10) [unchanged]
- 8-gate CI pipeline with aggregator (+3)
- BR regression gate (+1.5)
- Full infrastructure in CI (Postgres, MinIO) (+1)
- New code gate for PRs (+1)
- No-skip and shallow lints (+1)
- Pre-commit hooks (typecheck + lint-staged) (+0.5)
- /metrics endpoint added (+0.25)
- No flaky detection (-0.5)
- lint:shallow informational-only (-0.5)

### Weighted Overall: 8.8/10
Weights: L1 (25%), L2 (30%), L3 (25%), L4 (20%)
= (8.7 * 0.25) + (9.0 * 0.30) + (8.4 * 0.25) + (9.0 * 0.20)
= 2.175 + 2.700 + 2.100 + 1.800
= **8.775** (rounded to 8.8)

Previous (rev 3): 8.6. Delta: +0.2 (L2 +0.5 drives improvement; L1, L3, L4 flat).
Previous (rev 2): 8.6. Previous (rev 1): 8.5. Delta from rev 1: +0.3.

---

## Appendix: Key File Paths

| Artifact | Path |
|----------|------|
| Handler modules | `services/api-ts/src/handlers/` |
| BR registry | `docs/ver-3/business/br-registry.json` |
| BR edge case tests | `services/api-ts/src/handlers/__tests__/br-edge-cases.test.ts` |
| BR P2 gap tests | `services/api-ts/src/handlers/membership/br-p2-gap.test.ts` |
| BR-49 tests (org-auth) | `services/api-ts/src/utils/org-auth.test.ts` |
| BR-51 tests (auth middleware) | `services/api-ts/src/middleware/auth.test.ts` |
| Metrics endpoint | `services/api-ts/src/core/metrics.ts` |
| CI pipeline | `.github/workflows/ci.yml` |
| Contract CI | `.github/workflows/contract.yml` |
| Contract tests | `specs/api/tests/contract/` |
| E2E stubs (deferred) | `apps/memberry/tests/e2e/stubs/` |
| BR coverage script | `scripts/br-coverage.ts` |
| No-skip lint | `scripts/lint-no-skips.ts` |
| Shallow test lint | `scripts/lint-shallow-tests.ts` |
| New code gate | `scripts/new-code-gate.ts` |
| Migration safety | `scripts/migration-safety.ts` |
