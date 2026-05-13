---
phase: 13-position-based-rbac
plan: "05"
subsystem: frontend-nav
tags: [rbac, sidebar, position-filtering, ux]
dependency_graph:
  requires: [13-01]
  provides: [position-nav-config, officer-sidebar-filtering]
  affects: [apps/memberry/src/components/layout/officer-sidebar.tsx]
tech_stack:
  added: []
  patterns: [position-config-object, prop-drilling-positions]
key_files:
  created:
    - apps/memberry/src/config/position-nav.ts
  modified:
    - apps/memberry/src/components/layout/officer-sidebar.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx
decisions:
  - "POSITION_NAV_CONFIG uses lowercase keys for case-insensitive matching via pos.title.toLowerCase()"
  - "Dashboard (no label) always visible to all officers via empty-string sentinel in allowedSections Set"
  - "Fallback to show all sections when positions array is empty (safety net, not security)"
  - "Filtering logic in component function after sections array definition, before return"
metrics:
  duration: "~15 min"
  completed: 2026-05-08
  tasks_completed: 1
  tasks_total: 2
  files_modified: 3
---

# Phase 13 Plan 05: Position-Based Sidebar Nav Filtering Summary

Position-based sidebar nav filtering with POSITION_NAV_CONFIG driving which sections each officer position sees.

## Completed Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create POSITION_NAV_CONFIG and wire sidebar filtering | 711b89b | position-nav.ts, officer-sidebar.tsx, officer.tsx |

## Checkpoint Reached

**Task 2:** Visual verification checkpoint  
**Status:** Awaiting human verification  
**Type:** checkpoint:human-verify

User must visually verify each officer position sees the correct nav sections after starting the app.

## What Was Built

### `apps/memberry/src/config/position-nav.ts` (NEW)
Single-source config object mapping 4 position titles (lowercase) to allowed sidebar section labels per D-07:
- `president`: all 7 sections + SETTINGS (superset)
- `treasurer`: FINANCES, DOCUMENTS, SETTINGS
- `secretary`: MEMBERS, COMMUNICATIONS, SETTINGS
- `society officer`: ACTIVITIES, DOCUMENTS, SETTINGS

Dashboard (no label) always visible to all officers.

### `apps/memberry/src/components/layout/officer-sidebar.tsx` (MODIFIED)
- Added `positions?: Array<{ title: string }>` to `OfficerSidebarProps`
- Imports `POSITION_NAV_CONFIG` from `@/config/position-nav`
- Builds `allowedSections` Set per position via `pos.title.toLowerCase()` lookup
- Filters `sections` → `filteredSections` before rendering
- Fallback: shows all sections when no position data (safety net, not security)
- Render changed from `sections.map` to `filteredSections.map`

### `apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx` (MODIFIED)
- Passes `positions={positions}` to `OfficerSidebar` (positions already extracted from route context via `routeContext.officerPositions`)

## Deviations from Plan

### [Rule 3 - Blocking] Fixed worktree ESLint dependency gap
- **Found during:** Task 1 commit
- **Issue:** Worktree's `.bun` cache was missing `@typescript-eslint+eslint-plugin` and related packages that the main repo has. First commit touching `apps/memberry/**` files triggered lint-staged ESLint, which failed with `Cannot find module '@typescript-eslint/eslint-plugin'`.
- **Fix:** Copied missing bun cache packages from main repo to worktree cache, preserving symlinks: `@typescript-eslint+eslint-plugin`, `@typescript-eslint+parser`, `@typescript-eslint+typescript-estree`.
- **Impact:** All typechecks and ESLint now pass in the worktree.

## Verification Results

```
grep -c "POSITION_NAV_CONFIG" apps/memberry/src/config/position-nav.ts → 1 ✓
grep -c "filteredSections" apps/memberry/src/components/layout/officer-sidebar.tsx → 2 ✓
grep -c "positions=" apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx → 1 ✓
grep -c "officerPositions" apps/memberry/src/utils/guards.ts → 2 ✓ (REQ-05 confirmed)
TypeScript: all workspaces pass ✓
ESLint: no errors ✓
```

## Known Stubs

None. The filtering logic is fully wired — positions flow from route context → officer layout → sidebar → POSITION_NAV_CONFIG lookup → filteredSections render.

## Threat Flags

None beyond what the plan's threat model already documented (T-13-11, T-13-12 — both `accept` dispositions).

## Self-Check: PASSED

- [x] `apps/memberry/src/config/position-nav.ts` exists
- [x] `apps/memberry/src/components/layout/officer-sidebar.tsx` contains `filteredSections`
- [x] `apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx` contains `positions={positions}`
- [x] Commit `711b89b` exists in git log
