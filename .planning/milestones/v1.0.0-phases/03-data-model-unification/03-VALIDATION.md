---
phase: 3
slug: data-model-unification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (Bun built-in test runner) |
| **Config file** | `services/api-ts/bunfig.toml` |
| **Quick run command** | `cd services/api-ts && bun test` |
| **Full suite command** | `cd services/api-ts && bun test && cd ../../specs/api && bun run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/api-ts && bun test`
- **After every plan wave:** Run `cd services/api-ts && bun test && cd ../../specs/api && bun run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DATA-01 | — | N/A | integration | `cd services/api-ts && bun test` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | DATA-03 | — | N/A | migration | `cd services/api-ts && bun run db:generate` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | DATA-02 | — | N/A | integration | `cd services/api-ts && bun test` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | DATA-04 | — | N/A | typecheck | `cd specs/api && bun run build` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 3 | DATA-05 | — | N/A | integration | `cd services/api-ts && bun test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Bun test runner and TypeSpec build pipeline are already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero data loss migration | DATA-04 | Requires DB state inspection | Run migration, verify row counts match pre/post |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
