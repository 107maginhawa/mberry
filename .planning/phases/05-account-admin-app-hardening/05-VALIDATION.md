---
phase: 5
slug: account-admin-app-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright |
| **Config file** | `apps/admin/playwright.config.ts`, `apps/account/playwright.config.ts` |
| **Quick run command** | `cd apps/admin && bunx playwright test --grep "smoke"` |
| **Full suite command** | `cd apps/admin && bunx playwright test && cd ../account && bunx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick smoke test
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 05-01-01 | 01 | 1 | TEST-06 | e2e | `cd apps/admin && bunx playwright test` | ⬜ pending |
| 05-02-01 | 02 | 1 | TEST-05 | e2e | `cd apps/account && bunx playwright test` | ⬜ pending |
| 05-03-01 | 03 | 2 | TEST-05, TEST-06 | ci | `gh workflow run ci.yml` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — Playwright already installed in both apps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI runs all 3 apps' E2E tests | TEST-05, TEST-06 | Requires GitHub Actions runner | Trigger CI workflow and verify all test jobs pass |
