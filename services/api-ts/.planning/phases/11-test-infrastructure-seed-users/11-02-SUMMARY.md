---
phase: 11-test-infrastructure-seed-users
plan: "02"
subsystem: test-infrastructure
tags: [tdd, test-helper, authentication, api-testing]
dependency_graph:
  requires: []
  provides: [apiAs-helper]
  affects: [phases-12-16-all-backend-tests]
tech_stack:
  added: []
  patterns: [Better-Auth sign-in, cookie extraction via getSetCookie()]
key_files:
  created:
    - services/api-ts/src/tests/helpers/api-as.ts
    - services/api-ts/src/tests/helpers/api-as.test.ts
  modified: []
decisions:
  - Used typed interface ApiClient instead of any for return type
  - Replaced `(res.headers as any).getSetCookie` cast with narrower Headers intersection type
metrics:
  duration: "175s"
  completed: "2026-05-08T02:30:34Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 11 Plan 02: apiAs Authenticated Test Helper Summary

**One-liner:** JWT-free cookie-based authenticated test client using Better-Auth sign-in + getSetCookie() extraction.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write failing tests for apiAs helper | 5bc6c5a | api-as.test.ts, api-as.ts (stub) |
| 2 (GREEN) | Implement apiAs helper | 3e68081 | api-as.ts (full impl) |

## What Was Built

`apiAs(email, password?)` — authenticated HTTP client factory for backend TDD tests.

- Signs in via `POST /auth/sign-in/email` against the running API server
- Extracts session cookie using `getSetCookie()` (Bun/Node 18+ native multi-cookie support)
- Returns `ApiClient` with `get/post/put/patch/delete` methods that auto-attach the session cookie
- Exposes `cookie` string for tests that need raw cookie access
- Throws `Sign-in failed for {email}: {status}` on auth failure (nonexistent user, wrong password)
- Defaults to `http://localhost:7213` (overridable via `API_URL` env var)
- Default password `TestPass123!` matches seed user credentials

## TDD Gate Compliance

- RED gate: `test(11-02)` commit `5bc6c5a` — 5 failing tests confirmed
- GREEN gate: `feat(11-02)` commit `3e68081` — all 5 tests pass
- REFACTOR: not needed (implementation clean as written)

## Deviations from Plan

**1. [Rule 2 - Type Safety] Replaced `any` cast with typed Headers intersection**

- Found during: Task 2 (GREEN)
- Issue: Plan used `(res.headers as any).getSetCookie?.()` which suppresses type checking
- Fix: Used `(res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()` for narrower, safer cast
- Files modified: services/api-ts/src/tests/helpers/api-as.ts

**2. [Rule 3 - Worktree infra] Installed bun dependencies + symlinked @monobase/eslint-config**

- Found during: Task 1 commit
- Issue: Worktree lacked `node_modules` causing pre-commit hook eslint failure; `@monobase/eslint-config` not resolved from root
- Fix: `bun install --ignore-scripts` + `ln -sf packages/eslint-config node_modules/@monobase/eslint-config`
- Note: Pre-existing typecheck failures (scroll-area.tsx, toggle-group.tsx, @monobase/api-spec module resolution) in unrelated packages — not caused by this plan, logged to deferred items

## Known Stubs

None — `apiAs()` is fully implemented and functional.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. Helper is test-context only.

## Self-Check: PASSED

- [x] `services/api-ts/src/tests/helpers/api-as.ts` exists
- [x] `services/api-ts/src/tests/helpers/api-as.test.ts` exists
- [x] commit 5bc6c5a exists (RED)
- [x] commit 3e68081 exists (GREEN)
- [x] 5 tests pass via `bun test src/tests/helpers/api-as.test.ts`
