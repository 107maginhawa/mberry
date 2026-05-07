---
phase: 05-account-admin-app-hardening
plan: "02"
subsystem: e2e-tests
tags: [e2e, playwright, security, activation, auth-guard]
dependency_graph:
  requires: []
  provides: [account-activation-spec, memberry-security-spec]
  affects: [apps/account/tests/e2e, apps/memberry/tests/e2e]
tech_stack:
  added: []
  patterns: [playwright-e2e, auth-guard-testing, minimal-activation-smoke]
key_files:
  created:
    - apps/account/tests/e2e/activation.spec.ts
    - apps/memberry/tests/e2e/security.spec.ts
  modified:
    - apps/account/playwright.config.ts
decisions:
  - "reuseExistingServer: true (not !process.env.CI) — works for both local and CI where app is pre-booted"
  - "Account activation test stays minimal (2 tests only) per CONTEXT.md locked decision"
  - "Security spec covers /my/dashboard and /my/settings (not /my/profile which auth.spec.ts A2 already covers)"
metrics:
  duration: 10m
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_changed: 3
---

# Phase 05 Plan 02: Account App Activation + Memberry Security Spec Summary

Account activation E2E smoke test + playwright.config.ts webServer fix + memberry security flow spec (4 tests covering auth guard enforcement).

## Tasks Completed

| Task | Commit | Files |
|------|--------|-------|
| 1: Account activation spec + webServer fix | 27335be | apps/account/playwright.config.ts, apps/account/tests/e2e/activation.spec.ts |
| 2: Memberry security flow spec | 7375187 | apps/memberry/tests/e2e/security.spec.ts |

## What Was Built

**Task 1 — Account app activation:**
- Uncommented `webServer` block in `apps/account/playwright.config.ts` with `reuseExistingServer: true`
- Created `activation.spec.ts` with 2 minimal smoke tests:
  1. Homepage renders "Your Complete Service Management Platform" for unauthenticated user
  2. Auth redirect works — sign-in page loads and shows `input[name="email"]`

**Task 2 — Memberry security spec:**
- Created `security.spec.ts` with 4 tests:
  1. Unauthenticated user cannot access `/my/dashboard` — verifies redirect to `/auth/`
  2. Unauthenticated user cannot access `/my/settings` — verifies redirect to `/auth/`
  3. Authenticated user (test@memberry.ph) can access protected routes without redirect
  4. Invalid credentials (nonexistent@test.com + WrongPass123!) keep user on auth page

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree eslint dependency symlinks broken**
- **Found during:** Task 1 commit (pre-commit hook)
- **Issue:** `bun install` in worktree created symlinks to `.bun` cache entries that didn't exist in the worktree (only in main repo)
- **Fix:** Redirected `packages/eslint-config/node_modules/*` symlinks to point to main repo's `.bun` cache (`/Users/elad-mini/Desktop/memberry/node_modules/.bun/`)
- **Files modified:** packages/eslint-config/node_modules/* (symlinks only, not tracked)
- **Commit:** N/A (infrastructure fix, not committed)

## Known Stubs

None — specs reference real seeded test data (`test@memberry.ph`/`TestPass123!`).

## Threat Flags

None — specs test existing auth guard behavior, no new network surface introduced.

## Self-Check: PASSED

- [x] `apps/account/tests/e2e/activation.spec.ts` exists
- [x] `apps/account/playwright.config.ts` contains `reuseExistingServer: true`
- [x] `apps/memberry/tests/e2e/security.spec.ts` exists
- [x] Commit 27335be exists: feat(05-02): account app activation spec + webServer config fix
- [x] Commit 7375187 exists: feat(05-02): memberry security flow E2E spec
