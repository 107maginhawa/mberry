---
phase: 05-account-admin-app-hardening
plan: "04"
subsystem: account-app-e2e
tags: [e2e, playwright, account-app, bookings, settings, auth-guard]
dependency_graph:
  requires: []
  provides: [account-app-bookings-e2e, account-app-settings-e2e]
  affects: [TEST-05]
tech_stack:
  added: []
  patterns: [api-level-auth-helper, playwright-e2e]
key_files:
  created:
    - apps/account/tests/e2e/helpers/auth.ts
    - apps/account/tests/e2e/bookings.spec.ts
    - apps/account/tests/e2e/settings.spec.ts
  modified: []
decisions:
  - API-level sign-in helper (signInAsUser) mirrors admin app pattern for speed — no UI auth flow per test
  - Unauthenticated redirect tests use waitForTimeout(2000) after networkidle to allow TanStack Router guards to fire
  - Bookings invalid ID test asserts error OR redirect (not crash) — graceful degradation coverage
  - Security heading assertion uses /security settings/i regex to match "Security Settings" h1
metrics:
  duration: 286s
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_created: 3
---

# Phase 05 Plan 04: Account App Bookings + Settings E2E Tests Summary

Account app E2E tests for bookings and settings flows — completing TEST-05 coverage with auth helper, bookings spec (3 tests), and settings spec (4 tests).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Account app auth helper + bookings spec | 304d1a5 | helpers/auth.ts, bookings.spec.ts |
| 2 | Account app settings spec | 98c60ef | settings.spec.ts |

## What Was Built

### Auth Helper (`apps/account/tests/e2e/helpers/auth.ts`)
- `signInAsUser(context)` — API-level POST to `/auth/sign-in/email` with seeded test credentials
- `signInAndNavigate(page, path)` — signs in then navigates to path with networkidle wait

### Bookings Spec (`apps/account/tests/e2e/bookings.spec.ts`)
3 tests in `Account Bookings` describe block:
1. Authenticated user sees "Bookings" h1 heading — verifies page renders and URL is not auth
2. Unauthenticated redirect — clearCookies + navigate + waitForTimeout → URL contains `/auth/`
3. Invalid booking ID — graceful error or redirect (not crash)

### Settings Spec (`apps/account/tests/e2e/settings.spec.ts`)
4 tests in `Account Settings` describe block:
1. `/settings/account` renders "Account Settings" heading (PersonalInfoForm, cards)
2. `/settings/security` renders "Security Settings" heading (ChangePasswordCard, SessionsCard, etc.)
3. Unauthenticated redirect from `/settings/account`
4. Unauthenticated redirect from `/settings/security`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree node_modules missing transitive ESLint deps**
- **Found during:** Task 1 commit (lint-staged hook failure)
- **Issue:** Worktree's `.bun/` folder had `call-bind@1.0.9` but missing `ms` and `get-intrinsic` transitive deps; `@monobase/eslint-config` not at root `node_modules` level
- **Fix:** Created `node_modules/@monobase` → symlinked eslint-config; ran `bun install --ignore-scripts`; resolved broken symlinks by copying `ms@2.1.3` package and symlinking `get-intrinsic` and `set-function-length` into `call-bind`'s local node_modules
- **Files modified:** `node_modules/.bun/` (runtime-only, not committed)
- **Commit:** n/a (worktree infra fix, not in source)

## Known Stubs

None — spec files make real assertions against actual app pages. No hardcoded empty values.

## Threat Flags

None — only new test files; no network endpoints or auth paths introduced.

## Self-Check

Files created:
- [x] apps/account/tests/e2e/helpers/auth.ts — exists
- [x] apps/account/tests/e2e/bookings.spec.ts — exists
- [x] apps/account/tests/e2e/settings.spec.ts — exists

Commits:
- [x] 304d1a5 — feat(05-04): account app auth helper + bookings E2E spec
- [x] 98c60ef — feat(05-04): account app settings E2E spec (account + security pages)

Must-haves satisfied:
- [x] bookings.spec.ts verifies booking list page renders for authenticated user
- [x] bookings.spec.ts verifies invalid booking ID shows error or redirect (not crash)
- [x] settings.spec.ts verifies account settings page renders profile forms
- [x] settings.spec.ts verifies security settings page renders with Security Settings heading
- [x] Unauthenticated access to bookings and settings redirects to auth

## Self-Check: PASSED
