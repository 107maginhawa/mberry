---
phase: 11
slug: test-infrastructure-seed-users
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) + Playwright (E2E) |
| **Config file** | `services/api-ts/bunfig.toml` / `apps/memberry/playwright.config.ts` |
| **Quick run command** | `cd services/api-ts && bun test` |
| **Full suite command** | `cd services/api-ts && bun test && cd ../../apps/memberry && bun run test:e2e` |
| **Estimated runtime** | ~30 seconds (unit) + ~120 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd services/api-ts && bun test`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | — | — | N/A | integration | `cd services/api-ts && bun test` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | — | — | Officers NOT admin role | integration | `cd services/api-ts && bun test` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | — | — | N/A | unit | `cd services/api-ts && bun test` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | — | — | All 5 users login | E2E | `cd apps/memberry && bun run test:e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Seed script updates for 3 new officer users
- [ ] `apiAs()` test helper creation
- [ ] E2E test config with new user constants

*Existing test infrastructure (Bun test, Playwright) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DB positions correct | Phase verify | Requires DB query | `SELECT * FROM officer_term WHERE person_id IN (...)` |

*Most behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
