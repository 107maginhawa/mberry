---
phase: 2
slug: audit-module-completion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (API), Playwright (E2E) |
| **Config file** | `services/api-ts/bunfig.toml`, `apps/admin/playwright.config.ts` |
| **Quick run command** | `cd services/api-ts && bun test --filter audit` |
| **Full suite command** | `cd services/api-ts && bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/api-ts && bun test --filter audit`
- **After every plan wave:** Run `cd services/api-ts && bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUDT-02 | — | Middleware intercepts write ops | unit | `bun test --filter audit-middleware` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AUDT-01 | — | Audit events captured for all modules | integration | `bun test --filter audit` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | AUDT-04 | — | Admin dashboard renders audit table | e2e | `bunx playwright test audit` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AUDT-03 | — | E2E tests verify audit capture | e2e | `bunx playwright test audit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/api-ts/src/middleware/audit.test.ts` — unit tests for audit middleware
- [ ] `apps/admin/e2e/audit.spec.ts` — E2E test stubs for admin audit dashboard

*Existing infrastructure covers test framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin dashboard visual layout | AUDT-04 | Visual inspection | Browse /audit in admin app, verify table + filters render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
