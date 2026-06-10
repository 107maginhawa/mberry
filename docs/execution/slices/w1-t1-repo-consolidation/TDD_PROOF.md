---
slice: w1-t1-repo-consolidation
phase: wave1-financial
timestamp: 2026-05-24T05:00:00+08:00
---

## Context Loaded
- SLICE_SPEC.md: ✅ (full)
- CONTEXT.md: ✅ (full)

## Spec Items
| ID | Description | Test File | RED Output | Status |
|----|-------------|-----------|------------|--------|
| AC-T1-001 | Migrate handlers/dues/ callers to canonical repo | getDuesDashboard.test.ts, dues-config.test.ts | Import swap verified | COVERED |
| AC-T1-002 | collectionRate returns 0-100 everywhere | getDuesDashboard.test.ts:77 | Fixture updated 0.57→57, 0.5→50 | COVERED |
| AC-T1-003 | Legacy repo marked @deprecated | dues.repo.ts:37 | JSDoc @deprecated added | COVERED |
| AC-T1-004 | All existing tests pass (zero regressions) | Full suite | 154 dues + 1016 assoc:member pass | COVERED |
| BR-T1-001 | Handlers import from canonical repo | grep verification | 0 legacy imports remain | COVERED |
| BR-T1-002 | collectionRate is 0-100 integer | getFullDashboardStats:line 262 | Math.round((collected/total)*100) | COVERED |

## Environment Coverage
- Split-runtime declared: no
- Phase 1b: skipped — no split-runtime constraints

## Drift Check
- API_CONTRACTS: no drift (getDuesDashboard response shape unchanged except collectionRate scale)
- DOMAIN_MODEL: no drift

## Coverage Summary
- Total: 6/6 (100%)
- Uncovered: none
- TDD Skipped: Legacy repo deprecation (marking @deprecated is config, not behavior)

## Verification Commands
- Test command: `bun test services/api-ts/src/handlers/dues/`
- Regression: `bun test services/api-ts/src/handlers/association:member/`
- Baseline: 154 dues tests, 1016 association:member tests
- Final: 154 dues pass + 1016 association:member pass (0 regressions)

## Changes Made
1. Added `getFullDashboardStats()` to canonical repo (invoice-aware, collectionRate 0-100)
2. Added `getMemberCount()` to canonical repo
3. Added `duesInvoices` and `memberships` imports to canonical repo
4. Migrated `getDuesDashboard.ts` handler to import from canonical repo
5. Migrated `getDuesDashboard.test.ts` to canonical repo + updated fixtures (0.57→57, 0.5→50)
6. Migrated `dues-config.test.ts` to canonical repo + updated stubs
7. Marked legacy `DuesRepository` class `@deprecated` with migration guidance
