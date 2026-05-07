---
phase: 08-frontend-unit-tests
plan: "01"
subsystem: apps/memberry
tags: [testing, vitest, frontend, unit-tests]
dependency_graph:
  requires: []
  provides: [vitest-runner, test-utilities, migrated-lib-tests]
  affects: [apps/memberry]
tech_stack:
  added: [vitest@4.1.5, "@testing-library/jest-dom@6.9.1"]
  patterns: [vitest-config-mergeConfig, renderWithProviders]
key_files:
  created:
    - apps/memberry/vitest.config.ts
    - apps/memberry/src/test/setup.ts
    - apps/memberry/src/test/utils.tsx
  modified:
    - apps/memberry/package.json
    - apps/memberry/src/features/dues/lib/money.test.ts
    - apps/memberry/src/features/dues/lib/fund-math.test.ts (unchanged - already vitest)
    - apps/memberry/src/features/chapters/lib/royalty-split.test.ts
    - apps/memberry/src/features/directory/lib/visibility.test.ts
    - apps/memberry/src/features/invite/lib/token-validation.test.ts
    - apps/memberry/src/features/profile/lib/profile-display.test.ts
    - apps/memberry/src/features/membership/lib/membership-status.test.ts
decisions:
  - "Use mergeConfig(viteConfig, defineConfig({...})) pattern so tsconfig-paths plugin resolves @/ and workspace aliases without duplication"
  - "Install vitest in both worktree and main project app to ensure monorepo bun workspace resolution finds the binary"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  files_changed: 10
---

# Phase 08 Plan 01: Vitest Setup + Lib Test Migration Summary

**One-liner:** Vitest 4.1.5 configured with happy-dom environment via mergeConfig, 6 lib tests migrated from bun:test to vitest, all 54 tests passing.

## What Was Done

### Task 1: Install vitest + jest-dom, create config and test utilities
- Installed `vitest@4.1.5` and `@testing-library/jest-dom@6.9.1` as devDependencies in `apps/memberry`
- Created `vitest.config.ts` using `mergeConfig(viteConfig, ...)` to inherit tsconfig-paths plugin
- Created `src/test/setup.ts` importing `@testing-library/jest-dom` matchers
- Created `src/test/utils.tsx` exporting `renderWithProviders` (QueryClientProvider wrapper) and re-exporting `screen, within, waitFor`
- Updated `package.json`: `test` script changed to `vitest run`, added `test:watch` script

**Commit:** `274ea5e`

### Task 2: Migrate 6 existing lib tests from bun:test to vitest imports
- Replaced `import { describe, test, expect } from 'bun:test'` with `from 'vitest'` in 6 files
- `fund-math.test.ts` was already using vitest — left unchanged
- Result: 7 test files, 54 tests, all passing under `vitest run`

**Commit:** `feb4429`

## Verification

```
Test Files  7 passed (7)
     Tests  54 passed (54)
  Duration  489ms
```

- `grep -r "from 'bun:test'" apps/memberry/src/` — returns nothing (clean)
- `vitest.config.ts` contains `environment: 'happy-dom'`
- `src/test/setup.ts` imports `@testing-library/jest-dom`
- `src/test/utils.tsx` exports `renderWithProviders` with `QueryClientProvider`
- `package.json` test script is `vitest run`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bun workspace package resolution for vitest binary**
- **Found during:** Task 1 verification
- **Issue:** `bun add -d vitest` in the worktree placed packages in `.bun/` cache but did not create symlinks in the worktree's `node_modules`; the vitest binary was not available. The worktree is a git worktree of the monorepo with its own `bun.lock`.
- **Fix:** Also ran `bun add -d vitest @testing-library/jest-dom` in the main project's `apps/memberry` directory so the packages were properly installed and available to the worktree's resolution chain (shared `.bun/` cache + proper symlinks).
- **Files modified:** `apps/memberry/package.json` (both worktree and main project), `bun.lock`
- **Commit:** included in Task 1 commit `274ea5e`

## Known Stubs

None — this is test infrastructure only, no UI stubs.

## Threat Flags

None — test runner configuration only, no security surface.

## Self-Check: PASSED

- `apps/memberry/vitest.config.ts` exists ✓
- `apps/memberry/src/test/setup.ts` exists ✓
- `apps/memberry/src/test/utils.tsx` exists ✓
- Commit `274ea5e` exists ✓
- Commit `feb4429` exists ✓
- 7 test files, 54 tests pass under vitest ✓
- No `bun:test` imports remain in `apps/memberry/src/` ✓
