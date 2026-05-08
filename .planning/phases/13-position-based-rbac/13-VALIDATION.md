---
phase: 13
slug: position-based-rbac
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-08
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (Bun built-in test runner) |
| **Config file** | `services/api-ts/bunfig.toml` |
| **Quick run command** | `cd services/api-ts && bun test --filter "position"` |
| **Full suite command** | `cd services/api-ts && bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/api-ts && bun test --filter "position"`
- **After every plan wave:** Run `cd services/api-ts && bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | REQ-02, D-03 | T-13-01 | requirePosition returns null for matching position, 403 for non-matching | unit | `grep -c "export async function requirePosition" src/utils/officer-check.ts` | Wave 0 | pending |
| 01-T2 | 01 | 1 | REQ-01, D-01 | T-13-02 | RED tests: cross-position denial assertions (25+) | integration | `grep -c "expect(res.status)" src/tests/position-rbac.test.ts` | Wave 0 | pending |
| 02-T1 | 02 | 2 | REQ-03, D-01 | T-13-04 | 12 handlers use requirePosition with correct title arrays | integration | `cd services/api-ts && grep -rl "requirePosition" src/handlers/association:member/ src/handlers/communications/ \| wc -l` | post-01 | pending |
| 02-T2 | 02 | 2 | REQ-03, D-01 | T-13-05 | 4 President-only governance handlers wired | integration | `cd services/api-ts && grep -c "POSITION_TITLES.PRESIDENT\])" src/handlers/association:member/createElection.ts` | post-01 | pending |
| 03-T1 | 03 | 2 | REQ-03, D-01 | T-13-07 | 13 operations handlers use requirePosition with SocOfficer+President | integration | `cd services/api-ts && grep -rl "requirePosition" src/handlers/association:operations/ \| wc -l` | post-01 | pending |
| 04-T1 | 04 | 3 | REQ-03, D-01 | T-13-08 | 3 app.ts inline routes get requirePosition | integration | `cd services/api-ts && grep -c "requirePosition" src/app.ts` | post-02/03 | pending |
| 04-T2 | 04 | 3 | REQ-06 | T-13-10 | All position-rbac tests GREEN | integration | `cd services/api-ts && bun test src/tests/position-rbac.test.ts` | post-01 | pending |
| 05-T1 | 05 | 3 | REQ-04, REQ-05, D-06, D-07 | T-13-11 | Sidebar filters nav by position via POSITION_NAV_CONFIG | unit | `grep -c "POSITION_NAV_CONFIG" apps/memberry/src/config/position-nav.ts && grep -c "officerPositions" apps/memberry/src/utils/guards.ts` | new | pending |
| 05-T2 | 05 | 3 | REQ-06 | — | Visual: each position sees correct nav sections | manual | Login as each officer, verify nav | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `services/api-ts/src/utils/position-titles.ts` — position title constants (Plan 01 Task 1)
- [ ] `services/api-ts/src/utils/officer-check.ts` — requirePosition() function added (Plan 01 Task 1)
- [ ] `services/api-ts/src/tests/position-rbac.test.ts` — RED phase position-specific tests (Plan 01 Task 2)

*Existing `apiAs()` infrastructure from Phase 11 covers base auth testing.*

---

## Wave 2 Test Execution

Plans 02 and 03 (Wave 2) are mechanical handler upgrades. After completion, verify tests compile and position checks are wired:

- `cd services/api-ts && bun test --filter "position"` — Expected: RED tests still fail (app.ts routes not yet wired), but test file compiles and runs
- `cd services/api-ts && bun test` — Expected: existing Phase 12 tests still pass (no regressions from handler upgrades)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar shows correct nav per position | D-06, D-07 | Visual verification of nav group filtering | Login as each officer role, verify nav sections match D-01 matrix |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
