---
phase: 11-test-infrastructure-seed-users
plan: "01"
subsystem: seed-data
tags: [seed, test-users, officer-terms, e2e-config]
dependency_graph:
  requires: []
  provides: [seed-users-5, officer-terms-4, e2e-test-config-7-constants]
  affects: [phases/12, phases/13, phases/14, phases/15, phases/16]
tech_stack:
  added: []
  patterns: [drizzle-direct-insert, personIdMap-pattern]
key_files:
  created: []
  modified:
    - services/api-ts/src/seed.ts
    - apps/memberry/tests/e2e/helpers/test-config.ts
decisions:
  - "All 3 new officer users use dbRole 'association:member', not admin — officer authority comes from officer_term records only (T-11-01 mitigation)"
  - "Memberships for all 5 users use regularTier (not associateTier) since officers are regular members"
  - "personIdMap used to decouple position assignment from array index ordering"
metrics:
  duration: "5 minutes"
  completed: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 11 Plan 01: Seed Users & Test Config Summary

5 seed users + 4 officer positions + 4 officer_terms created in seed.ts; E2E test config extended with 3 officer email constants matching seed users.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 3 officer users + positions + officer_terms to seed.ts | 97c1eed | services/api-ts/src/seed.ts |
| 2 | Extend E2E test config with 3 new user constants | 755b784 | apps/memberry/tests/e2e/helpers/test-config.ts |

## What Was Built

### seed.ts changes
- `TEST_USERS` array extended from 2 to 5 entries: treasurer@memberry.ph (Jose Reyes, Prosthodontics), secretary@memberry.ph (Ana Lim, Pediatric Dentistry), society@memberry.ph (Lito Tan, Endodontics)
- `personIdMap: Map<string, string>` added to user creation loop (email -> personId)
- Section 7 replaced: now creates 4 OFFICER_POSITIONS (President, Treasurer, Secretary, Society Officer) with matching `officer_term` records
- Memberships loop updated to cover all 5 users (all use regularTier)
- Summary banner updated to show all 5 accounts with their positions

### test-config.ts changes
- 3 new exported constants appended: `SEED_TREASURER_EMAIL`, `SEED_SECRETARY_EMAIL`, `SEED_SOCIETY_EMAIL`
- Follow existing `process.env.VAR ?? 'default'` pattern
- File now has 7 total export const declarations

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Seed script changes are dev-only (no production surface).

## Self-Check: PASSED

- services/api-ts/src/seed.ts: contains treasurer@memberry.ph (3 occurrences), secretary@memberry.ph (3), society@memberry.ph (3), 4x `dbRole: 'association:member'`, personIdMap (5 references)
- apps/memberry/tests/e2e/helpers/test-config.ts: contains SEED_TREASURER_EMAIL, SEED_SECRETARY_EMAIL, SEED_SOCIETY_EMAIL (3 occurrences total)
- Commits 97c1eed and 755b784 exist in git log
