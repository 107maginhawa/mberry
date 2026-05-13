---
phase: 18
slug: dues-invoice-security-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test |
| **Config file** | services/api-ts/bunfig.toml |
| **Quick run command** | `cd services/api-ts && bun test --filter dues` |
| **Full suite command** | `cd services/api-ts && bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/api-ts && bun test --filter dues`
- **After every plan wave:** Run `cd services/api-ts && bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | SEC-01 | T-18-01 | markDuesInvoicePaid returns 403 for non-officers | unit | `bun test --filter markDuesInvoicePaid` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | SEC-02 | T-18-02 | Dues query endpoints return 403 for cross-org callers | unit | `bun test --filter dues` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | SEC-01 | T-18-03 | Officer of Org A cannot mark invoices paid for Org B | unit | `bun test --filter markDuesInvoicePaid` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | SEC-01, SEC-02 | — | Existing officer payment flows work (no regression) | integration | `bun test --filter dues` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/api-ts/src/handlers/dues/markDuesInvoicePaid.test.ts` — auth enforcement tests
- [ ] `services/api-ts/src/handlers/dues/dues-auth.test.ts` — cross-org isolation tests
