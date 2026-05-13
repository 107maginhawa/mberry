---
phase: 12-backend-auth-route-protection
plan: "03"
subsystem: api-ts
tags: [tdd, auth, rbac, officer-protection, green-phase, middleware]
dependency_graph:
  requires: [route-protection-handwired-tests, officer-auth-middleware]
  provides: [officer-routes-protected, requireOfficerTerm-utility]
  affects:
    - services/api-ts/src/app.ts
    - services/api-ts/src/utils/officer-check.ts
tech_stack:
  added: []
  patterns: [hono-middleware-chain, handler-level-auth-check]
key_files:
  created:
    - services/api-ts/src/utils/officer-check.ts
  modified:
    - services/api-ts/src/app.ts
decisions:
  - officerAuthMiddleware added after authMiddleware in chain for all 6 officer-only hand-wired routes
  - GET /membership/org-profile/:orgId intentionally left member-accessible per D-07
  - requireOfficerTerm queries officer_term directly to bypass orgContextMiddleware role='member' pitfall
metrics:
  duration: 15m
  completed: 2026-05-08
  tasks_completed: 2
  tasks_total: 2
---

# Phase 12 Plan 03: Wire officerAuthMiddleware and Create requireOfficerTerm Utility Summary

**One-liner:** GREEN phase wiring officerAuthMiddleware to 6 hand-wired app.ts officer-only routes and creating handler-level requireOfficerTerm utility that queries officer_term directly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire officerAuthMiddleware to hand-wired app.ts routes | e4a25ca | services/api-ts/src/app.ts |
| 2 | Create requireOfficerTerm utility | a7d32d2 | services/api-ts/src/utils/officer-check.ts |

## What Was Built

### Task 1: officerAuthMiddleware wired to 6 officer-only routes

Added import and middleware to `services/api-ts/src/app.ts`:

**Protected routes (member gets 403, officer gets 200):**
- `GET /credit-compliance/:orgId` — officer credit compliance report
- `PUT /membership/org-profile/:orgId` — officer org profile update
- `GET /membership/members/:orgId` — officer member list
- `GET /membership/applications/:orgId` — officer applications list
- `GET /dues/dashboard/:orgId` — officer dues dashboard
- `GET /officer-terms/:orgId` — officer terms list

**Left member-accessible (per D-07):**
- `GET /membership/org-profile/:orgId` — members can read org profile

### Task 2: requireOfficerTerm utility

Created `services/api-ts/src/utils/officer-check.ts` exporting `requireOfficerTerm(ctx)`:
- Returns `Response | null` (matching requireOrgRole convention per D-09)
- Queries `officer_term` table directly via OfficerTermRepository
- Handles: 401 if no user, 403 if no orgId, 403 if no active officer term
- Returns `null` if allowed (handler proceeds)
- Solves Pitfall 2: orgContextMiddleware always sets role='member', so requireOrgRole() cannot distinguish officers

## Verification

All 14 Plan 01 RED tests pass GREEN:
```
14 pass
0 fail
14 expect() calls
Ran 14 tests across 1 file. [33.00ms]
```

officerAuthMiddleware count in app.ts: 7 (1 import + 6 route wirings)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new network surface. Existing routes now correctly protected.

## TDD Gate Compliance

- RED gate: `test(12-01)` commit at 00ae8a5 (Plan 01 — tests written against mock app)
- GREEN gate: `feat(12-03)` commit at e4a25ca — real app.ts now matches mock wiring
- All 14 RED tests now pass against the wired implementation

## Self-Check: PASSED

- File exists: services/api-ts/src/app.ts — FOUND (modified)
- File exists: services/api-ts/src/utils/officer-check.ts — FOUND
- Commit e4a25ca exists — FOUND
- Commit a7d32d2 exists — FOUND
- 14 tests pass GREEN — VERIFIED
- officerAuthMiddleware count >= 6 — VERIFIED (7 total: 1 import + 6 routes)
