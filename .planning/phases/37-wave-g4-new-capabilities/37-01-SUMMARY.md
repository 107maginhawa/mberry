---
phase: 37-wave-g4-new-capabilities
plan: 01
subsystem: auth
tags: [session-limit, security, better-auth, V-15]
dependency_graph:
  requires: []
  provides: [concurrent-session-limits]
  affects: [auth, config]
tech_stack:
  added: []
  patterns: [hook-based-session-enforcement]
key_files:
  created:
    - services/api-ts/src/core/session-limit.ts
    - services/api-ts/src/core/session-limit.test.ts
  modified:
    - services/api-ts/src/core/auth.ts
    - services/api-ts/src/core/config.ts
    - services/api-ts/src/types/auth.ts
decisions:
  - Hook-based enforcement chosen because Better-Auth v1.3.x lacks native session limits
metrics:
  duration: 150s
  completed: 2026-05-20T03:58:33Z
  tasks_completed: 4
  tasks_total: 4
  files_changed: 5
---

# Phase 37 Plan 01: Concurrent Session Limits Summary

Hook-based session limit enforcement via Better-Auth session.create.after — default 5, configurable via SESSION_LIMIT env var, oldest auto-revoked.

## What Was Done

1. **Research**: Confirmed Better-Auth v1.3.x has no native `maximumActiveDevices` or equivalent config. Implemented at the databaseHooks level.

2. **Session limit module** (`session-limit.ts`): `enforceSessionLimit()` queries active sessions for a user after login, deletes oldest when count exceeds limit.

3. **Config integration**: Added `sessionLimit` to `AuthConfig` interface and `parseConfig()` with `SESSION_LIMIT` env var (default 5).

4. **Auth hook wiring**: Added `enforceSessionLimit()` call at the end of `session.create.after` hook in `auth.ts`, wrapped in try/catch to avoid breaking login flow.

## TDD Gate Compliance

- RED: `00d1532` — test for `config.auth.sessionLimit` fails (field not yet on AuthConfig)
- GREEN: `9e98f92` — all 9 session-limit tests + 262 core tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Verification

```
bun test src/core/ → 262 pass, 0 fail
bun test src/core/session-limit.test.ts → 9 pass, 0 fail
```

## Self-Check: PASSED

- [x] `services/api-ts/src/core/session-limit.ts` exists
- [x] `services/api-ts/src/core/session-limit.test.ts` exists
- [x] Commit `00d1532` exists (RED)
- [x] Commit `9e98f92` exists (GREEN)
