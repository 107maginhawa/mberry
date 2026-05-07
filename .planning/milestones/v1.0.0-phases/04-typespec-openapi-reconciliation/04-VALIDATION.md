---
phase: 04
slug: typespec-openapi-reconciliation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test + TypeSpec compiler |
| **Config file** | `specs/api/tspconfig.yaml`, `services/api-ts/bunfig.toml` |
| **Quick run command** | `cd specs/api && bun run build` |
| **Full suite command** | `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate && bun test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd specs/api && bun run build`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeSpec compiler (`cd specs/api && bun run build`) IS the Wave 0 test infrastructure — it validates that authored TypeSpec produces valid OpenAPI output. SDK generator (`cd packages/sdk-ts && bun run generate`) validates hook generation. No additional test scaffolding needed.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 04-01-01 | 01 | 1 | SPEC-05 | build | `cd specs/api && bun run build 2>&1 \| tail -5` | pending |
| 04-01-02 | 01 | 1 | SPEC-05, SPEC-06 | build | `cd specs/api && bun run build 2>&1 \| tail -5` | pending |
| 04-02-01 | 02 | 2 | SPEC-01 | build | `cd specs/api && bun run build 2>&1 \| tail -5` | pending |
| 04-02-02 | 02 | 2 | SPEC-02 | build | `cd specs/api && bun run build 2>&1 \| tail -5` | pending |
| 04-03-01 | 03 | 3 | SPEC-03 | build | `cd specs/api && bun run build 2>&1 \| tail -5` | pending |
| 04-03-02 | 03 | 3 | SPEC-04 | build | `cd specs/api && bun run build 2>&1 \| tail -5` | pending |
| 04-04-01 | 04 | 4 | SPEC-07, SPEC-08 | build+grep | `grep -c "election\|certificate\|dues-payment" specs/api/dist/openapi/openapi.json` | pending |
| 04-04-02 | 04 | 4 | SPEC-08 | grep | `grep -c "app.route('/dues'" services/api-ts/src/app.ts` (expect 0) | pending |
| 04-05-01 | 05 | 5 | SPEC-07 | grep | `grep -rl "api\.\(get\|post\).*'/api/dues" apps/memberry/src/features/dues/ \| wc -l` (expect 0) | pending |
| 04-05-02 | 05 | 5 | SPEC-07 | grep | `grep -rl "api\.\(get\|post\).*'/api/membership" apps/memberry/src/features/membership/ \| wc -l` (expect 0) | pending |
| 04-06-01 | 06 | 5 | SPEC-07 | grep | `grep -rl "api\.\(get\|post\).*'/api/\(elections\|certificates\)" apps/memberry/src/features/ \| wc -l` (expect 0) | pending |
| 04-06-02 | 06 | 5 | SPEC-07 | grep | `grep -rl "api\.\(get\|post\).*'/api/\(events\|training\)" apps/memberry/src/features/ \| wc -l` (expect 0) | pending |
| 04-07-01 | 07 | 6 | SPEC-07 | grep+typecheck | `grep -rl "api\.\(get\|post\).*'/api/\(dues\|membership\|elections\|certificates\|events\|training\)" apps/memberry/src/routes/ \| wc -l` (expect 0) | pending |
| 04-07-02 | 07 | 6 | SPEC-07 | human | Live app verification — data loads on all 6 module pages | pending |

*Status: pending / green / red / flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frontend hooks work | SPEC-07 | Need running app to verify React Query hooks render data | Start `bun dev` in app, navigate to pages using custom module data |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
