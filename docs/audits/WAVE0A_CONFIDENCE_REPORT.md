# Wave 0a Confidence Stack Report

**Date:** 2026-05-23
**Team size:** small
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** `docs/audits/WAVE0A_AUDIT.md` (behavior inventory from oli-audit-codebase)
**Scope:** Wave 0a files only (7 key files, 6 commits)

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **2/10** | No meaningful coverage — critical gaps in high-risk areas | 0/5 frontend behaviors covered; getTraining wired handler untested; getMyMemberships tests are WEAK |
| 2. Behavior Traceability | **1/10** | No meaningful traceability | 2/16 behaviors have test owners; 14 behaviors untraced |
| 3. Test Quality Hardening | **8/10** | Good — existing tests are well-written | Only 2 tests exist, but both use appropriate patterns; 1 STRONG assertion |
| 4. Release Gate Readiness | **4/10** | Minimal — CI lacks unit test, lint, typecheck steps | CI only runs contract tests; no rollback migrations; no changelog |

**Overall Confidence (L1-4): 1/10** (weakest layer: Behavior Traceability)
**Average Score: 3.75/10**

## Cross-Layer Consistency

**FLAGGED: L3 (8) exceeds L1 (2) and L2 (1) by 6-7 points.**
Cause: Only 2 tests exist in Wave 0a scope, but those 2 are well-written. The problem is QUANTITY not QUALITY. Need more tests, not better ones.

**FLAGGED: L4 (4) exceeds L1-2 (1-2) by 2-3 points.**
Cause: Infrastructure (health checks, CI) partially exists, but tests don't cover Wave 0a behaviors.

## Per-Module Breakdown

| Module | L1 | L2 | L3 | L4 | Overall | Priority Gaps |
|--------|----|----|----|----|---------|---------------|
| Frontend (org switching) | 0 | 0 | N/A | 4 | **0** | Zero tests for 5 components |
| Backend (person/getMyMemberships) | 3 | 2 | 7 | 4 | **2** | WEAK assertions, no orgSlug test |
| Backend (association:operations/getTraining) | 0 | 0 | N/A | 4 | **0** | Zero tests for wired handler |

## Layer 1: Coverage Integrity Detail

### "Covered" Definition Per Rule Class

| Rule Class | Meaningful Coverage Requires | Items | Covered | Line-Only | None | Weight |
|------------|------------------------------|-------|---------|-----------|------|--------|
| Auth/permissions | Deny AND allow test per gate | 5 | 1 | 0 | 4 | 44% (redistributed) |
| Business rules | Assertion on business outcome | 6 | 1 | 0 | 5 | 37% (redistributed) |
| State transitions | Guard + happy path test | 0 | — | — | — | (redistributed) |
| API routes | Response shape + status assertion | 2 | 0 | 1 | 1 | 19% (redistributed) |

### Weight Redistribution
State transitions not present in Wave 0a scope — weight redistributed proportionally among auth (44%), business rules (37%), API routes (19%).

### Scoring Detail
- Auth: 1/5 = 20% × 44% = 0.088
- Business rules: 1/6 = 17% × 37% = 0.063
- API routes: 0/2 meaningful = 0% × 19% = 0.000
- Raw score: 1.5 → **2/10**

### Auth/Permission Items

| Gate | Location | Deny Test | Allow Test | Score |
|------|----------|-----------|------------|-------|
| requireAuth redirect | `_authenticated.tsx:12` | NONE | NONE | NONE |
| getMyMemberships auth | `person/getMyMemberships.ts` | STRONG (`toThrow('Unauthorized')`) | NONE | PARTIAL |
| getTraining auth | `association:operations/getTraining.ts` | NONE | NONE | NONE |
| OrgProvider auth context | `OrgProvider.tsx` | NONE | NONE | NONE |
| getTraining org isolation | `association:operations/getTraining.ts` | NONE | NONE | NONE |

### Business Rule Items

| BR | Rule | Location | Test | Quality |
|----|------|----------|------|---------|
| BR-W0a-1 | Auth check on membership fetch | `getMyMemberships.ts` | `getMyMemberships.test.ts` | STRONG |
| BR-W0a-2 | Org isolation on training fetch (cross-org check) | `getTraining.ts` | NONE (dead handler has test) | NONE |
| BR-W0a-3 | Active org detection from URL slug | `useMyOrgs.ts` | NONE | NONE |
| BR-W0a-4 | Officer role detection for layout bypass | `_authenticated.tsx` | NONE | NONE |
| BR-W0a-5 | UUID→slug redirect for backwards compat | `$orgSlug/route.tsx` | NONE | NONE |
| BR-W0a-6 | Membership enrichment with orgSlug | `getMyMemberships.ts` | NONE | NONE |

### API Route Items

| Method | Path | Test | Quality |
|--------|------|------|---------|
| GET | /persons/me/memberships | `getMyMemberships.test.ts` | WEAK (status 200 only, no body shape) |
| GET | /association/training/:trainingId | NONE | NONE |

## Layer 2: Behavior Traceability Detail

### Full Behavior Inventory (Wave 0a)

| # | Behavior | Source | Test File | Quality |
|---|----------|--------|-----------|---------|
| 1 | useMyOrgs: fetch memberships | `useMyOrgs.ts` | — | NONE |
| 2 | useMyOrgs: detect active org from URL | `useMyOrgs.ts` | — | NONE |
| 3 | useMyOrgs: map API fields defensively | `useMyOrgs.ts` | — | NONE |
| 4 | OrgProvider: resolve slug to org | `OrgProvider.tsx` | — | NONE |
| 5 | OrgProvider: fetch officer role | `OrgProvider.tsx` | — | NONE |
| 6 | OrgProvider: expose isOfficer context | `OrgProvider.tsx` | — | NONE |
| 7 | OrgIconRail: render org avatars | `org-icon-rail.tsx` | — | NONE |
| 8 | OrgIconRail: highlight active org | `org-icon-rail.tsx` | — | NONE |
| 9 | OrgPickerSheet: navigate and close | `org-picker-sheet.tsx` | — | NONE |
| 10 | _authenticated: auth redirect | `_authenticated.tsx` | — | NONE |
| 11 | _authenticated: officer route bypass | `_authenticated.tsx` | — | NONE |
| 12 | getMyMemberships: auth check | `getMyMemberships.ts` | `getMyMemberships.test.ts` | STRONG |
| 13 | getMyMemberships: return memberships | `getMyMemberships.ts` | `getMyMemberships.test.ts` | WEAK |
| 14 | getMyMemberships: include orgSlug | `getMyMemberships.ts` | — | NONE |
| 15 | getTraining: auth + org check | `getTraining.ts` | — | NONE |
| 16 | getTraining: return training data | `getTraining.ts` | — | NONE |

**Traced: 2/16 = 12.5% → 1/10**

### Untraced Behaviors (14)
All frontend behaviors (#1-11) and backend behaviors #14-16 have no test owner. Most critical untraced:
1. **OrgProvider slug resolution** — every org page depends on this
2. **getTraining org isolation** — security-critical
3. **useMyOrgs active org detection** — drives nav highlighting
4. **Auth redirect** — gates entire authenticated experience

## Layer 3: Test Quality Hardening Detail

### Assertion Audit

| Test File | Strong | Weak | Total | Strength % |
|-----------|--------|------|-------|------------|
| `person/getMyMemberships.test.ts` | 1 | 1 | 2 | 50% |

**Wave 0a total: 1 strong / 2 total = 50%**

Strong assertions:
- `rejects.toThrow('Unauthorized')` — asserts specific error message ✓

Weak assertions:
- `expect(res.status).toBe(200)` — checks status only, no body shape verification

### Mock Audit

| Test File | Mock Type | Classification |
|-----------|-----------|---------------|
| `getMyMemberships.test.ts` | Inline `mockDb` object | APPROPRIATE (unit test, DB mocked correctly) |

**1/1 mocks appropriate = 100%**

### Flake Detection

| Test File | Status |
|-----------|--------|
| `getMyMemberships.test.ts` | STABLE (no skip, no retry, no timeouts) |

**2/2 tests stable = 100%**

### Data Audit

| Test File | Status | Notes |
|-----------|--------|-------|
| `getMyMemberships.test.ts` | SEEDED | Uses `makeCtx()` factory, fresh per test |

**Composite L3 Score:**
- Assertion strength: 50% × 40% = 2.0
- Mock appropriateness: 100% × 20% = 2.0
- Flake rate: 100% × 20% = 2.0
- Data stability: 100% × 20% = 2.0
- **Total: 8.0/10**

**Caveat:** Score is misleadingly high — only 2 tests in sample. Quality is good but quantity is critically low.

## Layer 4: Release Gate Readiness Detail

### CI Pipeline Check

| Check | Status | Notes |
|-------|--------|-------|
| CI config found | YES | `.github/workflows/contract.yml` |
| Test step (unit/integration) | **ABSENT** | CI runs contract tests (Hurl) only, NOT `bun test` or `vitest` |
| Lint step | **ABSENT** | No lint step in CI |
| Type check step | **ABSENT** | No `tsc --noEmit` in CI |
| Build step | PRESENT | Builds OpenAPI spec + codegen |
| Security scan step | **ABSENT** | No Snyk/npm audit |

**CI score: 1/5 = 20% → 2/10 × 35% = 0.7**

### Migration Safety

| Check | Status | Notes |
|-------|--------|-------|
| Migration files found | YES | 42 SQL files in `src/generated/migrations/` |
| Rollback/down files | **NO** | Drizzle ORM doesn't generate down migrations |
| CI dry-run | **NO** | No migration validation in CI |

**Migration score: 0.5/2 = 25% → 2.5/10 × 25% = 0.63**

### Version Management

| Check | Status |
|-------|--------|
| Version file | YES (`package.json`) |
| CHANGELOG.md | **NO** |
| Release workflow/script | **NO** |

**Version score: 1/3 = 33% → 3.3/10 × 20% = 0.67**

### Health Check Endpoint

| Check | Status |
|-------|--------|
| Health endpoint found | YES (`/health`, `/readyz`) |
| Dependency depth | **DEEP** (checks DB connection) |

**Health score: 10/10 × 20% = 2.0**

**Composite L4 Score: 0.7 + 0.63 + 0.67 + 2.0 = 4.0/10**

## Prioritized Action Plan

### P0 — Critical (blocks confidence above 2/10)

| # | Action | Layer Impact | Files |
|---|--------|-------------|-------|
| 1 | Write `useMyOrgs.test.ts` — test fetch, active org detection, error state, field mapping | L1 +1, L2 +2 | `apps/memberry/src/hooks/useMyOrgs.test.ts` (new) |
| 2 | Write `OrgProvider.test.tsx` — test slug resolution, officer fetch, context value | L1 +1, L2 +2 | `apps/memberry/src/providers/OrgProvider.test.tsx` (new) |
| 3 | Write `getTraining.test.ts` for WIRED handler — auth, org isolation, happy path | L1 +1, L2 +2 | `services/api-ts/src/handlers/association:operations/getTraining.test.ts` (new) |
| 4 | Expand `getMyMemberships.test.ts` — test orgSlug presence, empty result, multi-org | L1 +0.5, L2 +1 | `services/api-ts/src/handlers/person/getMyMemberships.test.ts` |

### P1 — Important (blocks confidence above 5/10)

| # | Action | Layer Impact |
|---|--------|-------------|
| 5 | Write `org-icon-rail.test.tsx` — render, active highlight, nav click | L2 +1 |
| 6 | Write `org-picker-sheet.test.tsx` — open/close, select nav | L2 +1 |
| 7 | Add unit test + lint + typecheck steps to CI | L4 +3 |

### P2 — Important (blocks confidence above 7/10)

| # | Action | Layer Impact |
|---|--------|-------------|
| 8 | Add vitest coverage thresholds for Wave 0a components | L1 +1 |
| 9 | Add CHANGELOG.md | L4 +0.5 |
| 10 | Port dead handler tests, then delete dead code | L2 +0.5, L3 stable |

## Projected Scores After Remediation

| Layer | Current | After P0 | After P0+P1 | After All |
|-------|---------|----------|-------------|-----------|
| L1 | 2 | 5 | 6 | 7 |
| L2 | 1 | 6 | 8 | 9 |
| L3 | 8 | 8 | 8 | 8 |
| L4 | 4 | 4 | 7 | 8 |
| **Overall** | **1** | **4** | **6** | **7** |

## What's Next

Overall < 7/10. Remediation path:
1. Write P0 tests (actions 1-4) → projected overall: 4/10
2. Write P1 tests + fix CI (actions 5-7) → projected overall: 6/10
3. Complete P2 items (actions 8-10) → projected overall: 7/10

Then run `/oli-confidence-stack` again to verify scores improved.
