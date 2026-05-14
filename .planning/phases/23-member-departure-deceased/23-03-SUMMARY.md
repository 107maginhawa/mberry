---
phase: 23-member-departure-deceased
plan: 03
subsystem: billing, notifications
tags: [tdd, lif-03, exclusion-guard, regression-protection]
dependency_graph:
  requires: [23-01]
  provides: [LIF-03 explicit test coverage]
  affects: []
tech_stack:
  added: []
  patterns: [mock-db-sequencing, GREEN-on-write TDD, inArray guard documentation]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.test.ts
  modified:
    - services/api-ts/src/handlers/dues/jobs/reminderProcessor.test.ts
decisions:
  - "GREEN-on-write TDD: exclusion already works via implicit WHERE/inArray guards; tests add regression protection"
  - "Billing tests assert filter logic directly (no ctx/handler wiring) because handler requires full DB + auth stack"
  - "Notification tests extend existing mock-DB sequenced pattern from reminderProcessor.test.ts"
metrics:
  duration: ~10min
  completed: 2026-05-14T01:21:46Z
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements: [LIF-03]
---

# Phase 23 Plan 03: Billing + Notification Exclusion Guard Tests Summary

**One-liner:** Explicit regression-guard tests proving resigned/deceased/expelled members are excluded from dues invoice generation (WHERE eq(status,'active')) and reminder sends (inArray(['active','gracePeriod'])).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Billing exclusion tests for departed members | 7786bb2 | generateDuesInvoicesForOrg.test.ts (created) |
| 2 | Notification exclusion tests for departed members | 1513c12 | reminderProcessor.test.ts (extended) |

## What Was Built

### Task 1 — Billing Exclusion Tests (`7786bb2`)

Created `generateDuesInvoicesForOrg.test.ts` with 5 tests under `describe('LIF-03: departed member exclusion from dues invoice generation')`:

1. `[LIF-03] resigned member is not returned by active-only query` — verifies resigned status excluded
2. `[LIF-03] deceased member is not returned by active-only query` — verifies deceased excluded, only active person gets invoice
3. `[LIF-03] expelled member is not returned by active-only query` — verifies expelled excluded
4. `[LIF-03] only active members appear in invoice batch` — comprehensive fixture with all 3 departed + 2 active; confirms 2 invoices, 0 departed
5. `[LIF-03] WHERE clause pattern: eq(status, active) is the sole membership filter` — documents the contract

**Test result:** 5 pass, 0 fail.

### Task 2 — Notification Exclusion Tests (`1513c12`)

Extended `reminderProcessor.test.ts` with 5 new tests inside `describe('LIF-03: departed member notification exclusion')`:

1. `[LIF-03] resigned member is excluded from reminders by inArray guard`
2. `[LIF-03] deceased member is excluded from reminders by inArray guard`
3. `[LIF-03] expelled member is excluded from reminders by inArray guard`
4. `[LIF-03] inArray guard: only active and gracePeriod receive reminders` — documents the allowed-statuses contract
5. `[LIF-03] mixed org: active member gets reminder, departed members do not` — verifies only `person-active` receives notification

**Test result:** 13 pass total (8 existing + 5 new), 0 fail.

## Deviations from Plan

None — plan executed exactly as written.

Notes:
- Pre-existing typecheck errors in `registry.ts`, `membership.repo.ts`, and `system/` handlers are out of scope (present before this plan, unrelated to test files).
- Billing handler tests use filter-level assertions (no ctx wiring) because `generateDuesInvoicesForOrg` requires a full authenticated context + DB transaction stack. This is equivalent to what the plan's fallback suggests ("verify the WHERE clause logic").

## TDD Gate Compliance

This plan used GREEN-on-write TDD — the exclusion already exists in production code. Tests document the invariant and prevent regressions. Both test files pass immediately because the WHERE/inArray guards are already correct.

Both test files have `test(23-03)` commits per the commit protocol. No separate RED gate was required because this is explicitly a documentation/regression-guard plan (per plan objective: "LIF-03 requires explicit test coverage to document this guarantee").

## Self-Check

- [x] `generateDuesInvoicesForOrg.test.ts` exists and has 5 tests (>20 lines, all pass)
- [x] `reminderProcessor.test.ts` has 5 new LIF-03 tests (all pass, total 13 pass)
- [x] Commits 7786bb2 and 1513c12 exist
- [x] Both test files have LIF-03 references in describe/test names

## Self-Check: PASSED
