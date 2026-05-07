---
phase: 04-typespec-openapi-reconciliation
plan: "09"
subsystem: dues-frontend
tags: [sdk-migration, gap-closure, dues, member-search]
dependency_graph:
  requires: []
  provides: [SPEC-07-gap2-closed]
  affects: [apps/memberry/src/features/dues/components/record-payment-form.tsx]
tech_stack:
  added: []
  patterns: [sdk-query-hook, debounced-usequery]
key_files:
  modified:
    - apps/memberry/src/features/dues/components/record-payment-form.tsx
decisions:
  - "Display RosterMember using memberNumber/personId fields (SDK type has no firstName/lastName)"
metrics:
  duration: "5 minutes"
  completed: "2026-05-06"
requirements: [SPEC-07]
---

# Phase 04 Plan 09: SDK Member Search Migration Summary

Replace last manual api.get call in dues payment form with listRosterMembersOptions SDK hook, closing Gap 2 of SPEC-07.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace manual api.get with listRosterMembersOptions | 805e0e5 | record-payment-form.tsx |

## What Was Done

Replaced the debounced `api.get` member search in `record-payment-form.tsx` with a proper SDK-based pattern:

1. Removed `api` import from `@/lib/api` — no longer used
2. Added `listRosterMembersOptions` import from `@monobase/sdk-ts/generated/react-query`
3. Replaced manual `useEffect`+`setTimeout`+`api.get` pattern with:
   - `debouncedSearch` state (300ms debounce preserved)
   - `useQuery` with `listRosterMembersOptions` and `enabled: debouncedSearch.length >= 2`
4. Adapted member dropdown display to `RosterMember` SDK type (no firstName/lastName — shows memberNumber or personId)
5. Removed manual `memberResults`/`searchingMembers` state — now derived from query result

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RosterMember type has no firstName/lastName fields**
- **Found during:** Task 1
- **Issue:** Plan suggested mapping `m.firstName`/`m.lastName` but `RosterMember` SDK type only has `personId`, `memberNumber`, and membership metadata — no person name fields
- **Fix:** Display `m.memberNumber || m.personId` in dropdown. This is correct SDK behavior.
- **Files modified:** record-payment-form.tsx
- **Commit:** 805e0e5

## Verification

- `grep -c "api.get" record-payment-form.tsx` = 0 (confirmed)
- `grep -c "listRosterMembersOptions" record-payment-form.tsx` = 2 (confirmed)
- `grep -c "import.*api.*from.*@/lib/api" record-payment-form.tsx` = 0 (confirmed)
- `bunx tsc --noEmit` passes clean in apps/memberry

## Known Stubs

None — member search now hits the real SDK endpoint.

## Threat Flags

None — no new network surface introduced. Security posture unchanged (bearer auth required on `/association/member/roster`).

## Self-Check: PASSED

- File exists: apps/memberry/src/features/dues/components/record-payment-form.tsx — FOUND
- Commit 805e0e5 — FOUND
