---
phase: 09-test-infrastructure-hardening
plan: "02"
subsystem: ci-devex
tags: [ci, pre-commit, unit-tests, typecheck, lint-staged]
dependency_graph:
  requires: []
  provides: [ci-unit-tests-all-workspaces, pre-commit-typecheck-gate]
  affects: [.github/workflows/ci.yml, .husky/pre-commit]
tech_stack:
  added: []
  patterns: [husky pre-commit hook, lint-staged, bun workspaces CI]
key_files:
  modified:
    - .github/workflows/ci.yml
    - .husky/pre-commit
decisions:
  - Omit memberry and admin from lint-staged: no eslint.config.js in either app
  - No bun test in pre-commit: unit tests too slow (DB deps, multiple workspaces); CI is the real gate
  - No bun build in pre-commit: builds are slow and already verified in CI
metrics:
  duration: 4m
  completed: "2026-05-06"
  tasks: 2
  files: 2
---

# Phase 9 Plan 02: CI Unit-Test Coverage + Pre-commit Typecheck Gate Summary

CI unit-tests job expanded to all 4 workspaces (api-ts, memberry, account, sdk-ts) and pre-commit hook upgraded from lint-only to typecheck + lint-staged.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Expand CI unit-tests job with all workspace test commands | f7d6236 | .github/workflows/ci.yml |
| 2 | Expand pre-commit hook with typecheck gate | 8900af9 | .husky/pre-commit |

## What Was Built

**Task 1 — CI unit-tests job:** Added two new steps after the existing api-ts and memberry steps:
- `Run account unit tests`: `cd apps/account && bun run test`
- `Run SDK unit tests`: `cd packages/sdk-ts && bun run test`

Unit-tests job now covers all 4 workspaces with test scripts.

**Task 2 — Pre-commit hook:** Replaced single `bunx lint-staged` with:
```
bun run typecheck
bunx lint-staged
```

`bun run typecheck` expands to `bun run --filter '*' typecheck` (all workspaces) per root package.json. Catches type errors before commit. Lint-staged unchanged — covers api-ts and account only.

## Deviations from Plan

### Auto-fixed Issues

None.

### Scope Adjustments

**Lint-staged: memberry and admin omitted** — Plan instructed to verify `apps/memberry/eslint.config.js` and `apps/admin/eslint.config.js` exist before adding them. Neither exists. Per plan: "If either doesn't exist, omit that entry." Lint-staged config unchanged (api-ts + account only).

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- [x] `.github/workflows/ci.yml` contains `cd apps/account && bun run test`
- [x] `.github/workflows/ci.yml` contains `cd packages/sdk-ts && bun run test`
- [x] `.husky/pre-commit` contains `bun run typecheck`
- [x] `.husky/pre-commit` contains `bunx lint-staged`
- [x] Pre-commit does NOT contain `bun test`
- [x] Commits f7d6236 and 8900af9 exist on worktree-agent-a8bd3291
