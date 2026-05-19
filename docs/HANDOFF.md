# Memberry Fix-Forward Handoff

**Date:** 2026-05-19
**Author:** Claude (automated, human-supervised)
**Branch:** `feature/phase0-foundation`
**Commits:** `c770b44`, `d3513e2`

---

## What Was Broken

32 test failures across 336 test files, traced to 5 root causes:

| Root Cause | Tests Affected | Fix |
|---|---|---|
| `mock.module` poison — Bun test runner leaks module-level mocks across files | ~20 tests, 11 files | Converted to prototype-level `stubRepo()` pattern |
| `stubRepo` prototype pollution — `ensurePristine()` captured already-polluted state in parallel execution | 14+ tests | Created `preload-pristine.ts` as Bun preload (Day 2: 14 repos → Day 6: 50 repos) |
| `describe.todo` counted as failure — Bun treats `describe.todo` blocks as test failures | ~100 tests, 7 files | Converted to `describe.skip` with `// TODO:` comments |
| Import path error in `br-edge-cases.test.ts` | 1 file | Fixed relative import path |
| PAY-02 handler logic — `listDuesPayments` returned wrong results for officers without `personId` | 1 test | Fixed query filter logic |

## What Was Fixed (Day 6 Audit)

| Fix | Commit | Detail |
|---|---|---|
| SVG XSS mitigation (P0) | `d3513e2` | Removed `image/svg+xml` from upload MIME allowlist + rejection test |
| Prototype pollution coverage (WR-01) | `d3513e2` | `preload-pristine.ts` expanded from 14 → 50 repos — all `stubRepo()`'d classes pre-snapshotted |
| Pre-existing lint error | `d3513e2` | Fixed `no-constant-binary-expression` in `check-in.test.ts` |
| Compliance false positive corrected | `d3513e2` | BR-08 refund handler exists at `association:member/refundDuesPayment.ts` (audit searched wrong directory) |

## Current State

| Gate | Status | Command |
|---|---|---|
| Tests | **2935 pass, 0 fail**, 93 skip, 23 todo | `cd services/api-ts && bun test` |
| Typecheck | **All 6 packages pass** | `bun run typecheck` |
| Lint | **0 errors** | `bun run lint` |
| Build (account) | **Pass** | `bun run --filter account build` |
| Build (memberry) | **Pass** | `bun run --filter memberry build` |
| Build (admin) | **Pass** | `bun run --filter admin build` |

### Audit Scores

| Audit | Score | Report |
|---|---|---|
| Spec Compliance | **8.1/10** (post-fix) | `docs/audits/COMPLIANCE_REPORT.md` |
| Test Confidence | **8.4/10** | `docs/audits/CONFIDENCE_REPORT.md` |
| Code Review | **0 critical, 6 warnings** | `docs/audits/CODE_REVIEW.md` |

---

## How to Run Locally

```bash
# Install dependencies
bun install

# Start dev dependencies (Postgres + MinIO)
cd services/api-ts && bun run dev:deps:up

# Seed database
bun run db:seed-modules

# Start API
bun dev
# → http://localhost:7213

# Run tests
bun test                    # unit + integration (18s)
bun run typecheck           # all 6 packages
bun run lint                # eslint

# Build all apps
bun run build

# Additional quality gates
bun run test:br             # BR coverage regression gate
bun run lint:no-skips       # no silent test skips
bun run lint:shallow        # weak assertion detection
bun run lint:migrations     # migration safety
bun run test:contract       # Hurl contract tests (requires running API)
```

---

## CI Pipeline (`.github/workflows/ci.yml`)

8 gates already in place:
1. Build OpenAPI spec
2. Generate API codegen
3. Typecheck (all packages)
4. Lint
5. Migration safety lint
6. No silent test skips
7. Dependency audit
8. E2E tests (all 3 apps, Postgres + MinIO in CI)

### Recommended CI Additions

| Gate | Script | Why |
|---|---|---|
| BR coverage gate | `bun run test:br --ci` | Catches new BRs without test coverage. Already exists as script, not in CI workflow |
| Shallow assertion lint | `bun run lint:shallow` | Flags `toBeTruthy`/`toBeDefined` patterns. Exists, not in CI |

---

## What's Deferred (and Why)

### P1 — Fix Before New Feature Work

| Item | BR | Why Deferred |
|---|---|---|
| Import matching logic | BR-22 | Requires design decision on match strategy (email vs license vs name). Not a quick fix |
| Account deletion/anonymization | BR-32 | Phase 2 feature. `cancelAccountDeletion.ts` exists but `deleteMyAccount.ts` doesn't. Needs privacy review |
| `terminated` vs `removed` status mismatch | — | Terminology drift between spec and code. Needs glossary alignment pass |
| Election integrity gaps | BR-33 | Partial implementation. `todo` tests mark known gaps |

### P2 — Fix When Touching Module

| Item | Detail |
|---|---|
| Credit cycle anchoring (BR-11) | Cycle start not validated against member registration date |
| Credit carry-over cap (BR-12) | 50% cap not found in handler code |
| License normalization (BR-23) | No normalization function found |
| TypeSpec coverage ~60% | Many endpoints lack TypeSpec definitions |
| Input validation gaps | Several handlers missing Zod validation on optional fields |

### Separate Efforts (Not Part of Fix-Forward)

| Item | Effort | Notes |
|---|---|---|
| Full module specs (22-section format) for 19 modules | ~2 days | Run `/oli-module-specs` when ready |
| `stubRepo` → dependency injection refactor | ~3 days | Requires auditing 335 test files. Current preload approach is stable |
| BR-34 E2E test | ~0.5 day | Backend coverage thorough. Needs Playwright + seed data setup |
| SVG upload with sanitization | ~0.5 day | Re-enable `image/svg+xml` with DOMPurify or similar content sanitization |
| Mutation testing | ~1 day | Confidence report flagged as gap. No mutation testing tool in stack |

---

## Key Files

| File | Purpose |
|---|---|
| `services/api-ts/src/test-utils/preload-pristine.ts` | Bun preload — snapshots all 50 repo prototypes before test execution |
| `services/api-ts/src/test-utils/make-ctx.ts` | Test context builder — `stubRepo()`, `restoreRepo()`, `ensurePristine()` |
| `.planning/FIX-FORWARD-PLAN.md` | Original 7-day plan |
| `.planning/DAY2-RESULTS.md` | Day 2 root cause analysis and fix details |
| `docs/audits/COMPLIANCE_REPORT.md` | Spec compliance audit (8.1/10) |
| `docs/audits/CONFIDENCE_REPORT.md` | Test confidence audit (8.4/10) |
| `docs/audits/CODE_REVIEW.md` | Code review of Day 2 changes |
| `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` | Full codebase health audit (8.7/10) |

---

## Periodic Maintenance

| Task | Frequency | Command |
|---|---|---|
| Compliance audit | At milestones or weekly | `/oli-audit-compliance` (AI-driven, ~2h, not CI-suitable) |
| Confidence stack | At milestones | `/oli-confidence-stack` |
| Codebase health audit | At milestones | `/oli-audit-codebase` |
| Add new repos to preload | When creating new repo classes | Edit `preload-pristine.ts` — grep instructions in file header |
