---
phase: 12
slug: backend-auth-route-protection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | `services/api-ts/bunfig.toml` |
| **Quick run command** | `cd services/api-ts && bun test --filter route-protection` |
| **Full suite command** | `cd services/api-ts && bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/api-ts && bun test --filter route-protection`
- **After every plan wave:** Run `cd services/api-ts && bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | D-01 | T-12-01 | Member gets 403 on hand-wired officer routes | integration | `bun test --filter route-protection-handwired` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | D-01 | T-12-02 | Member gets 403 on association mutation routes | integration | `bun test --filter route-protection-association` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 1 | D-03/D-04 | T-12-03 | Officer of Org A blocked from Org B data | integration | `bun test --filter route-protection-idor` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/api-ts/src/middleware/route-protection-handwired.test.ts` — stubs for D-01 hand-wired route tests
- [ ] `services/api-ts/src/middleware/route-protection-association.test.ts` — stubs for D-01 association route tests
- [ ] `services/api-ts/src/middleware/route-protection-idor.test.ts` — stubs for D-03/D-04 IDOR tests

*Existing test infrastructure (Bun test, apiAs helper) covers all framework needs.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
