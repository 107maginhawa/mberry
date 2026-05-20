# Test Confidence Stack Report

**Project:** Memberry (monobase monorepo)
**Date:** 2026-05-20 (rev 3)
**Previous:** 2026-05-20 (rev 2)
**Auditor:** oli-confidence-stack v3
**Stack:** TypeScript + Hono + Drizzle ORM + Bun test + Vitest + Playwright

---

## Executive Summary

| Metric | Previous (rev 2) | Current (rev 3) | Delta |
|--------|-------------------|-------------------|-------|
| **Overall Confidence Score** | **8.6 / 10** | **8.6 / 10** | -- |
| Layer 1: Coverage Integrity (25%) | 8.6 / 10 | 8.7 / 10 | +0.1 |
| Layer 2: Behavior Traceability (30%) | 9.0 / 10 | 8.5 / 10 | -0.5 |
| Layer 3: Test Quality (25%) | 8.1 / 10 | 8.4 / 10 | +0.3 |
| Layer 4: Release Gate Readiness (20%) | 9.0 / 10 | 9.0 / 10 | -- |

**Verdict:** Confidence holds at 8.6 despite BR expansion from 40 to 51. Layer 1 improves as jobs/advertising reach 100% handler coverage. Layer 3 jumps on strong assertion ratio (93.2%, up from 89%). Layer 2 drops because 2 new BRs (BR-49 Active Status Includes Grace Period, BR-51 Internal Service Token Timing-Safe Comparison) have **zero tests** -- BR-51 is p0-security severity. Net: overall flat, but composition shifted. **Action required: BR-51 (p0-security) needs tests immediately.**

---

## Test Inventory

| Test Type | Previous | Current | Delta | Notes |
|-----------|----------|---------|-------|-------|
| Backend unit/integration (handler) | 388 | 380 | -8 | Recount: 368 handler + 12 core |
| Frontend component (Vitest) | 86 | 86 | -- | memberry (54) + account (32) |
| E2E Playwright | 101 | 101 | -- | memberry (92) + admin (6) + account (3) |
| Contract (Hurl) | 97 | 97 | -- | Spec-first, against live API |
| SDK tests | 5 | 5 | -- | packages/sdk-ts |
| **Total test files** | **672** | **669** | **-3** | Recount normalization |
| **Total assertions** | **8,545** | **9,460** | **+915** | All `expect()` calls across all types |

### Assertion Breakdown

| Source | Count |
|--------|-------|
| Backend `expect()` | 6,929 |
| Memberry component `expect()` | 746 |
| Account component `expect()` | 565 |
| Memberry E2E `expect()` | 656 |
| Admin E2E `expect()` | 53 |
| Account E2E `expect()` | 37 |
| Hurl assertions (HTTP + jsonpath) | 474 |
| **Total** | **9,460** |

### Deferred/Incomplete Tests

| Type | Previous | Current | Delta |
|------|----------|---------|-------|
| `test.todo()` | 21 | 21 | -- |
| `test.skip()` / conditional skip | 8 | 8 | -- |
| `test.fixme()` (E2E stubs) | 59 | 55 | -4 |
| **Total deferred** | **88** | **84** | **-4** |

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
| advertising | 7 | 7 | 100% | **Good (was 14%)** |
| jobs | 7 | 7 | 100% | **Good (was 14%)** |
| notifs | 6 | 7 | 117% | Good |
| certificates | 4 | 7 | 175% | Excellent |
| reviews | 4 | 5 | 125% | Good |
| comms | 11 | 5 | 45% | Thin |
| invite | 3 | 4 | 133% | Good |
| audit | 1 | 4 | 400% | Good |
| marketplace | 9 | 3 | 33% | **Improved (was 11%)** |
| storage | 6 | 2 | 33% | **Thin** |
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

- **IMPROVED:** `advertising` 1→7 tests (14%→100%), `jobs` 1→7 tests (14%→100%), `marketplace` 1→3 tests (11%→33%), `association:operations` 12→13 tests
- **UNCHANGED:** `storage` (2 tests / 6 handlers) -- still thin
- **REMOVED from below-50% list:** advertising, jobs

### Strengths
- 25/25 modules have at least 1 test file (100% module coverage)
- Co-located test pattern aids discoverability
- New code gate enforces test-first on PRs
- advertising + jobs modules now at 100% handler coverage (up from 14%)

---

## Layer 2: Behavior Traceability (8.5/10)

### BR Coverage Summary

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Total business rules | 40 | 51 | +11 |
| STRONG (>=2 test layers) | 34 | 37 | +3 |
| WEAK (1 test layer only) | 6 | 12 | +6 |
| NONE (0 test layers) | 0 | 2 | +2 |
| Coverage (any test) | 100% | 96.1% | -3.9% |

### Layer-Level Coverage

| Layer | Count | % |
|-------|-------|---|
| With backend tests | 48 | 94.1% |
| With contract tests | 36 | 70.6% |
| With E2E tests | 36 | 70.6% |
| All 3 layers | 34 | 66.7% |

### BR Status Matrix

| Status | Count | BRs |
|--------|-------|-----|
| COMPLETE (all 3 layers) | 34 | BR-01 through BR-34 |
| STRONG (2 layers) | 3 | BR-41, BR-42, BR-43 |
| WEAK (1 layer only) | 12 | BR-35–BR-40, BR-44–BR-46, BR-47, BR-48, BR-50 |
| **UNTESTED** | **2** | **BR-49, BR-51** |

### UNTESTED BRs (CRITICAL)

| BR | Rule | Classification | Risk |
|----|------|---------------|------|
| **BR-49** | Active Status Includes Grace Period | p1-business | HIGH -- grace period logic untested |
| **BR-51** | Internal Service Token Timing-Safe Comparison | **p0-security** | **CRITICAL -- security primitive untested** |

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
| BR-50 | Election Date Ordering DB Constraints | p0-data | backend |

### Observations
- BR registry expanded from 40 to 51 BRs (11 new rules added)
- Original 34 COMPLETE BRs retain full 3-layer coverage
- 11 new BRs mostly have backend tests but lack contract/E2E layers
- BR-51 (p0-security) with 0 tests is the highest-risk gap in the entire codebase
- BR-47 has E2E but no backend test -- unusual inversion
- CI regression gate via `scripts/br-coverage.ts --ci` prevents silent degradation

---

## Layer 3: Test Quality (8.4/10)

### Assertion Quality Metrics

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Strong assertions (toBe/toEqual/toThrow/toContain/toMatchObject/rejects) | ~89% | 93.2% | +4.2% |
| Weak assertions (toBeDefined/toBeTruthy/toBeFalsy) | ~4% | 6.8% | +2.8% |
| Assertions per test file (backend) | 14.0 | 18.2 | +4.2 |
| Error path test coverage | All sampled | All sampled | -- |

### Strong vs Weak Assertion Breakdown (Backend)

| Type | Count | % |
|------|-------|---|
| Strong (toBe, toEqual, toStrictEqual, toThrow, toContain, toMatchObject, toHaveBeenCalled, rejects) | 6,744 | 93.2% |
| Weak (toBeDefined, toBeTruthy, toBeFalsy, toBeNull, toBeUndefined) | 491 | 6.8% |
| **Total categorized** | **7,235** | |

### Quality Improvements Since Previous

- Strong assertion ratio jumped from 89% to 93.2%
- Assertions per backend test file grew from 14.0 to 18.2 (deeper tests)
- 4 E2E fixme stubs resolved (55 remaining, down from 59)
- Total assertions grew +915 to 9,460

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

### Weaknesses (unchanged)
- No explicit per-test timeout enforcement (only job-level)
- No flaky test detection/retry mechanism in CI
- No mutation testing
- `lint:shallow` exits 0 always -- should fail CI on tautological assertions

---

## Top Gaps and Risk Areas

### Priority 0 (Address Immediately)
1. **BR-51 (Internal Service Token Timing-Safe Comparison) has ZERO tests** -- p0-security classification. This is a timing-attack defense that must be verified with backend tests (confirm constant-time comparison is used).

### Priority 1 (Address Now)
2. **BR-49 (Active Status Includes Grace Period) has ZERO tests** -- p1-business. Grace period membership logic untested at any layer.
3. **BR-47 (Banned Users Rejected at Auth Middleware) has E2E but no backend test** -- p0-auth. Unit test needed for the middleware layer.
4. **BR-50 (Election Date Ordering DB Constraints) backend-only** -- p0-data. Needs contract test.

### Priority 2 (Address Soon)
5. **association:operations** has 54 handlers but only 13 test files (24% ratio) -- second-largest module.
6. **storage** remains at 2 tests for 6 handlers.
7. **55 `test.fixme()` E2E stubs** -- Track as v2.0 debt (down from 59).
8. **BR-44, BR-45, BR-46, BR-48** (p1-business) need contract/E2E layers.

### Priority 3 (Nice to Have)
9. **lint:shallow should fail CI** on tautological `expect(true).toBe(true)` patterns.
10. **Mutation testing** -- Stryker.js for deeper effectiveness validation.
11. **Flaky test detection** -- Add retry/tagging in CI config.

---

## Scoring Methodology

### Layer 1: Coverage Integrity (8.7/10) [was 8.6]
- 25/25 modules have tests (+3)
- Co-located test pattern (+1)
- New code gate enforces test-first (+1)
- advertising + jobs now at 100% handler coverage (+0.3)
- marketplace improved from 11% to 33% (+0.1)
- association:operations still thin (24%) (-0.5)
- storage still thin (33%) (-0.4)
- comms thin (45%) (-0.2)
- 2 mega-modules below 30% (-0.6)

### Layer 2: Behavior Traceability (8.5/10) [was 9.0]
- 51 BRs total (expanded from 40) (+1)
- 49/51 have at least 1 test layer (+2.5)
- 34/51 have all 3 layers (+1.5)
- Formal BR registry with CI gate (+2)
- BR references in test names (+1)
- **2 BRs with ZERO tests including 1 p0-security (-2.5)**
- 12 WEAK BRs (1 layer only) (-1.0)
- BR-47 missing backend test for p0-auth (-0.5)

### Layer 3: Test Quality (8.4/10) [was 8.1]
- 93.2% strong assertion ratio (+3.5) [up from 89%]
- Error path testing in all sampled files (+1.5)
- Business rule edge cases well-tested (+1)
- Assertions per test file 18.2 (up from 14.0) (+0.5)
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
- No flaky detection (-0.5)
- lint:shallow informational-only (-0.5)

### Weighted Overall: 8.6/10
Weights: L1 (25%), L2 (30%), L3 (25%), L4 (20%)
= (8.7 * 0.25) + (8.5 * 0.30) + (8.4 * 0.25) + (9.0 * 0.20)
= 2.175 + 2.550 + 2.100 + 1.800
= **8.625** (rounded to 8.6)

Previous (rev 2): 8.6. Delta: 0.0 (composition shift: L1+0.1, L2-0.5, L3+0.3, L4 flat).
Previous (rev 1): 8.5. Delta from rev 1: +0.1.

---

## Appendix: Key File Paths

| Artifact | Path |
|----------|------|
| Handler modules | `services/api-ts/src/handlers/` |
| BR registry | `docs/ver-3/business/br-registry.json` |
| BR edge case tests | `services/api-ts/src/handlers/__tests__/br-edge-cases.test.ts` |
| BR P2 gap tests | `services/api-ts/src/handlers/membership/br-p2-gap.test.ts` |
| CI pipeline | `.github/workflows/ci.yml` |
| Contract CI | `.github/workflows/contract.yml` |
| Contract tests | `specs/api/tests/contract/` |
| E2E stubs (deferred) | `apps/memberry/tests/e2e/stubs/` |
| BR coverage script | `scripts/br-coverage.ts` |
| No-skip lint | `scripts/lint-no-skips.ts` |
| Shallow test lint | `scripts/lint-shallow-tests.ts` |
| New code gate | `scripts/new-code-gate.ts` |
| Migration safety | `scripts/migration-safety.ts` |
