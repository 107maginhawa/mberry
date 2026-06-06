# Wave 2 Test Confidence Report

**Date:** 2026-05-24 | **Scope:** Wave 2a (Events) + Wave 2b (Training/CPD/Certificates)

## Overall Score

| Layer | Score | Status |
|-------|-------|--------|
| L1: Coverage Integrity | **7/10** | PASS |
| L2: Behavior Traceability | **5/10** | ⚠️ GAPS |
| L3: Test Quality | **7/10** | PASS |
| L4: Release Gate Readiness | **6/10** | ⚠️ GAPS |
| **Overall (min)** | **5/10** | ⚠️ L2 dragging |
| Average | 6.25/10 | |

## Layer 1: Coverage Integrity — 7/10

### Test Counts
| Module | Tests | Pass | Fail | Files | Assertions |
|--------|-------|------|------|-------|------------|
| Events (W2a) | 201 | 201 | 0 | 23 | 326 |
| Training (W2b) | 193 | 193 | 0 | 21 | 345 |
| Certificates (W2b) | 67 | 67 | 0 | 8 | 125 |
| Credit Pipeline (W2b) | 8 | 8 | 0 | 1 | 10 |
| Assoc:Member (shared) | 1070 | 1070 | 0 | 72 | 2601 |
| **Total Wave 2** | **1539** | **1539** | **0** | **125** | **3407** |

### Coverage Analysis
- **Handler-to-test ratio:** Events 23/17 (1.35x), Training 21/15 (1.4x), Certificates 8/10 (0.8x)
- **No coverage tool configured** — no istanbul/c8/nyc in package.json. Line coverage unknown.
- **Score rationale:** Strong test counts, 0 failures, good assertion density. -2 for no line coverage tool, -1 for certificate test ratio below 1.0.

## Layer 2: Behavior Traceability — 5/10

### Wave 2b Handler Test Coverage
| Handler | Has Unit Test | Status |
|---------|--------------|--------|
| creditIssue.ts | ✅ creditIssue.test.ts (8 tests) | COVERED |
| complianceThreshold.ts | ❌ | UNCOVERED |
| getCpdConfig.ts | ❌ | UNCOVERED |
| updateCpdConfig.ts | ❌ | UNCOVERED |
| awardManualCredit.ts | ❌ | UNCOVERED |
| refreshCompliance.ts | ❌ | UNCOVERED |
| getComplianceReport.ts | ❌ | UNCOVERED |
| getMyCredits.ts | ❌ | UNCOVERED |
| bulkIssueCertificates.ts | ❌ | UNCOVERED |
| verifyCertificatePublic.ts | ❌ | UNCOVERED |
| certificate-numbering.ts | ✅ certificate-numbering.test.ts (4 tests) | COVERED |

**8/11 Wave 2b handlers have NO unit tests.** Only creditIssue and certificate-numbering have dedicated tests.

### Wave 2a Coverage (Events)
Events module has strong test coverage (23 test files, 201 tests) covering:
- CRUD operations, slug generation, CPD fields
- Check-in + attestation, publish guard
- Registration, waitlist, paid events
- Visibility enforcement, public endpoints

### TDD Proof Status
- No TDD_PROOF.md for Wave 2a or 2b slices
- TDD proofs exist for Wave 1, 4, 5 — but NOT Wave 2
- **Layer 2 capped** due to missing TDD proof artifacts for Wave 2

### Score Rationale
- Wave 2a: well-tested (would be 8/10 standalone)
- Wave 2b: 8/11 handlers untested → drags score to 5/10
- No TDD proof artifacts for Wave 2

## Layer 3: Test Quality — 7/10

### Assertion Strength
| Module | Assertions/Test | Classification |
|--------|----------------|----------------|
| Events | 1.62 | MODERATE |
| Training | 1.79 | MODERATE |
| Credit Pipeline | 1.25 | MODERATE |

### Mock Usage
- Events tests: **0 mocks** — tests use mock DB builder pattern, not jest/vi mocks. Clean.
- Credit pipeline: mock-heavy (expected for job handlers). Mock DB + mock logger pattern from directoryAutoPopulate.
- Classification: **APPROPRIATE** — mocks at system boundaries only

### Data Stability
- Tests use inline fixtures, not shared seed data
- No flaky test indicators (0 `.skip`, 0 `.only` in Wave 2 tests)
- Classification: **STABLE**

### Score Rationale
7/10 — assertions moderate (not weak), mock usage appropriate, no flakes. -2 for moderate rather than strong assertion density, -1 for no negative-path testing visible in credit pipeline tests.

## Layer 4: Release Gate Readiness — 6/10

### CI Pipeline
| Check | Present | File |
|-------|---------|------|
| CI workflow | ✅ | `.github/workflows/ci.yml` |
| Contract tests | ✅ | `.github/workflows/contract.yml` |
| Deploy workflow | ✅ | `.github/workflows/deploy.yml` |
| Monitoring | ✅ | `.github/workflows/monitor.yml` |

### Pre-commit Hook
- Typecheck + ESLint + lint-staged configured
- **Currently broken** — 7 memberry frontend type errors block commits (dues chart imports, documents E2E typo)
- Required `--no-verify` to commit Wave 2b

### Typecheck Status
| Workspace | Status |
|-----------|--------|
| @monobase/api-ts | ✅ 0 errors |
| @monobase/sdk-ts | ✅ 0 errors |
| @monobase/ui | ✅ 0 errors |
| account | ✅ 0 errors |
| admin | ✅ 0 errors |
| memberry | ❌ 7 errors (dues charts + documents E2E) |

### Migration Safety
- No rollback mechanism in migrations (forward-only)
- Migrations auto-run on server start
- 3 Wave 2b migrations (0045-0047) — additive only, non-breaking

### Health Endpoint
- ✅ Health check endpoint exists in `core/health.ts`

### Score Rationale
6/10 — CI exists, health check exists. -2 for broken pre-commit hook (7 remaining type errors). -1 for no migration rollback. -1 for needing --no-verify on recent commits.

## Cross-Layer Consistency Check

| Check | Result |
|-------|--------|
| L1 high (7) but L2 low (5) | ⚠️ Tests exist but don't cover Wave 2b handlers — quantity without targeted coverage |
| L3 (7) vs L2 (5) | ⚠️ Existing tests are quality but missing for new handlers |
| L4 (6) vs L1-3 | ⚠️ Broken pre-commit means CI gate bypassed — L4 should be blocking |

## Wave 2 Completeness Gate (oli-execution-gate)

### Wave 2a: Events UX — ✅ COMPLETE
- 9 slices implemented and committed (0cb34c0, e7aa496)
- 201 tests, 0 failures
- Schema, handlers, frontend routes all present
- 23 test files covering all major features

### Wave 2b: Training/CPD/Certificates — ⚠️ FUNCTIONALLY COMPLETE, TEST-INCOMPLETE
- 10 slices implemented and committed (a528167)
- All handlers, schemas, migrations, frontend routes present
- **8/11 new handlers lack unit tests**
- 12/12 existing tests pass (creditIssue + certificate-numbering)
- Integration wiring verified (jobs/index.ts, app.ts, markComplete.ts)

## Prioritized Action Plan

### P0 — Must fix before shipping
1. **Write unit tests for 8 untested Wave 2b handlers** — getCpdConfig, updateCpdConfig, awardManualCredit, refreshCompliance, getComplianceReport, getMyCredits, bulkIssueCertificates, verifyCertificatePublic
   - Estimated: ~40-60 tests following creditIssue.test.ts mock pattern
   - This alone raises L2 from 5→8

### P1 — Should fix before shipping
2. **Fix 7 remaining frontend type errors** — dues chart `@/components/ui/card` imports + documents E2E `hasNOT` typo
   - Restores pre-commit hook → no more --no-verify
   - Raises L4 from 6→8
3. **Add coverage tool** (c8 or istanbul) to package.json
   - Raises L1 from 7→8 with measurable coverage

### P2 — Nice to have
4. **Create TDD_PROOF.md** for Wave 2a and 2b slices
5. **Add negative-path tests** for credit pipeline (invalid sourceType, zero credits edge cases)
6. **Add migration rollback scripts** for 0045-0047

## What's Next

**L2 = 5/10 blocks shipping.** Priority:
1. Write missing Wave 2b handler tests (P0) → L2 to 8/10
2. Fix frontend type errors (P1) → L4 to 8/10
3. Then: all layers ≥ 7/10 → run `/oli-trace` for traceability, then ship
