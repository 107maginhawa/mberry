---
phase: 12-backend-auth-route-protection
plan: "04"
subsystem: backend-auth
tags: [idor, cross-org-isolation, seed-data, integration-tests, security]
dependency_graph:
  requires: [12-01]
  provides: [idor-seed-data, idor-integration-tests]
  affects: [services/api-ts/src/seed.ts, services/api-ts/src/tests/route-protection-idor.test.ts]
tech_stack:
  added: []
  patterns: [integration-test-with-apiAs, idempotent-seed-section]
key_files:
  created:
    - services/api-ts/src/tests/route-protection-idor.test.ts
  modified:
    - services/api-ts/src/seed.ts
decisions:
  - "tierId is NOT NULL in memberships table — must create org2 tier before inserting org2 membership"
  - "org1 membership loop filters out idor-officer to avoid seeding them in the wrong org"
  - "org B ID looked up at runtime via /public/org/pda-cebu to avoid hardcoding dynamic UUIDs"
  - "8 total tests: 6 cross-org 403 assertions + 2 sanity 200 assertions"
metrics:
  duration: "12m"
  completed: "2026-05-08"
  tasks_completed: 2
  files_changed: 2
---

# Phase 12 Plan 04: IDOR Seed Data and Cross-Org Isolation Tests Summary

One-liner: Seeded org2 officer (idor-officer@memberry.ph) with active term in pda-cebu and wrote 8 integration tests proving officerAuthMiddleware blocks cross-org IDOR attacks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Seed second org officer for IDOR tests | 58602ab | services/api-ts/src/seed.ts |
| 2 | RED+GREEN — Write cross-org isolation (IDOR) tests | 3b15d18 | services/api-ts/src/tests/route-protection-idor.test.ts |

## What Was Built

### Task 1: Seed second org officer

Added `idor-officer@memberry.ph` (Carlos Dizon) to the TEST_USERS array and a new section 8 in the seed script that:
- Creates a `REGULAR` membership tier for org2 (pda-cebu) — required because `tierId` is NOT NULL
- Inserts membership `PDA-CEBU-001` for the IDOR officer in org2
- Creates a `President` position in org2
- Inserts an active `officer_term` linking the officer to the position in org2
- All steps are idempotent (existence-checked before insert)

Fixed the org1 membership loop to exclude `idor-officer@memberry.ph` (their membership belongs in org2 only).

Updated the seed summary box to display both org IDs and the IDOR officer email.

### Task 2: Cross-org IDOR isolation tests

Created `route-protection-idor.test.ts` (89 lines) with 8 integration tests:

**403 cross-org tests (6):**
- `treasurer@memberry.ph` (org A officer) → 403 on org B roster, dues dashboard, and applications
- `idor-officer@memberry.ph` (org B officer) → 403 on org A roster, dues dashboard, and applications

**200 sanity tests (2):**
- `treasurer@memberry.ph` → 200 on own org roster
- `idor-officer@memberry.ph` → 200 on own org roster

The `officerAuthMiddleware` from Plan 03 naturally enforces cross-org isolation by checking `officer_terms` for the specific `:orgId` param — if no active term exists for that org, the request is rejected with 403.

## TDD Gate Compliance

This plan has `type: tdd`. The tests (GREEN) pass immediately because:
1. `officerAuthMiddleware` (Plan 03) checks `officer_term` for the specific `orgId` param
2. Org A officer has no term in org B → 403 (natural IDOR prevention)
3. Org B officer has no term in org A → 403 (natural IDOR prevention)

The RED phase would have failed before Plan 03 wired the middleware. With Plan 03 complete, GREEN is achieved as designed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created org2 membership tier before inserting membership**
- **Found during:** Task 1 implementation
- **Issue:** `memberships.tierId` is `NOT NULL` — the plan's seed template omitted tier creation for org2
- **Fix:** Added idempotent org2 tier creation (REGULAR, PHP 2500/yr) before the membership insert
- **Files modified:** services/api-ts/src/seed.ts
- **Commit:** 58602ab

**2. [Rule 1 - Bug] Fixed org1 membership loop to exclude idor-officer**
- **Found during:** Task 1 implementation
- **Issue:** Original loop iterated all `personIds` including idor-officer, which would insert them into org1 — wrong org
- **Fix:** Filter out idor-officer from org1PersonIds before the loop
- **Files modified:** services/api-ts/src/seed.ts
- **Commit:** 58602ab

## Known Stubs

None — no stubs or placeholders in delivered files.

## Threat Flags

No new threat surface introduced. This plan adds test fixtures and integration tests only.

| Threat | Mitigated By |
|--------|-------------|
| T-12-10: GET /membership/members cross-org | officerAuthMiddleware — 403 confirmed by tests |
| T-12-11: PUT /membership/org-profile cross-org | officerAuthMiddleware (not tested here, covered by handwired plan) |
| T-12-12: GET /dues/dashboard cross-org | officerAuthMiddleware — 403 confirmed by tests |
| T-12-13: POST /association/* wrong orgId | officerAuthMiddleware (not tested here) |

## Self-Check: PASSED

- [x] `services/api-ts/src/seed.ts` modified — grep -c 'idor-officer' returns 8
- [x] `services/api-ts/src/tests/route-protection-idor.test.ts` created — 89 lines
- [x] Commit 58602ab exists (Task 1)
- [x] Commit 3b15d18 exists (Task 2)
- [x] File has 6 cross-org 403 assertions and 2 sanity 200 assertions
- [x] File imports `apiAs` from `@/tests/helpers/api-as`
- [x] File references both org IDs (pda-metro-manila and pda-cebu)
