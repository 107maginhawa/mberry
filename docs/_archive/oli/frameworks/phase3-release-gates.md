# Phase 3: Release Gates — Implementation Record

> Completed 2026-05-13. Gates wired before gap fill (Phase 4).

## Gate Stack (ordered)

| # | Gate | CI Job | Blocks PR? | Status |
|---|------|--------|-----------|--------|
| 1 | TypeScript + ESLint | `lint-typecheck` | Yes | Existing |
| 2 | Dependency audit | `lint-typecheck` (step) | No (warning) | **New** |
| 3 | Backend unit tests | `unit-tests` | Yes | Existing |
| 4 | Frontend unit tests + coverage | `unit-tests` | Yes | **Updated** — coverage thresholds enforced |
| 5 | E2E tests (3 apps) | `e2e` | Yes | Existing |
| 6 | Contract tests (Hurl) | `contract` | Yes | Existing |
| 7 | Docker build validation | `build-api` | Yes | Existing |
| 8 | Frontend builds | `build-frontends` | Yes | Existing |
| 9 | BR coverage regression | `coverage-gate` | Yes | Existing (Phase 1) |
| 10 | New handler test ratchet | `new-code-gate` | Yes (PRs only) | **New** |
| 11 | Summary gate | `ci-gate` | Yes | **New** — single required check |

## Coverage Floors

| App | Statements | Branches | Functions | Lines |
|-----|-----------|----------|-----------|-------|
| Memberry | 67% | 62% | 58% | 70% |
| Account | 75% | 76% | 75% | 75% |
| API (bun) | No threshold (tracked) | — | — | 83.49% baseline |

Floors set ~2% below measured baseline. Ratchet up as coverage improves.

## New Code Gate

`scripts/new-code-gate.ts` — checks that newly **added** handler files (vs base branch) have a corresponding `.test.ts` file. Modified files are grandfathered. Only runs on PRs.

Excluded from gate: test files, schema files, repos/, jobs/, utils/, index.ts, generated/.

## Branch Protection Setup

Run once to configure GitHub branch protection:

```bash
# Require ci-gate to pass + PR required + no direct push
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci-gate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":0}' \
  --field restrictions=null
```

For solo dev: `required_approving_review_count: 0` allows self-merge.
For team: bump to 1.

## Files Changed

- `.github/workflows/ci.yml` — audit step, coverage flags, new-code-gate job, ci-gate job
- `apps/memberry/vitest.config.ts` — coverage thresholds
- `apps/account/vitest.config.ts` — coverage thresholds
- `scripts/new-code-gate.ts` — new handler test ratchet script
- `apps/memberry/package.json` — @vitest/coverage-v8 dev dep
- `apps/account/package.json` — @vitest/coverage-v8 dev dep
