# E2E Depth — Wave 2 Status + Handoff

Date: 2026-06-06T00:00:00Z
Wave 2 status: PARTIAL — critical-path specs upgraded, sweep deferred.

## What landed in Wave 2 (this branch)
- `scripts/audit-e2e-depth.ts` + gate (`scripts/audit-e2e-depth-gate.ts`)
- `apps/memberry/tests/e2e/auth.spec.ts` — real-flow verdict
- `apps/memberry/tests/e2e/billing.spec.ts` — real-flow verdict
- `docs/quality/E2E_DEPTH_AUDIT.md` + `.json` baseline

## Remaining work (handed off)
- 79 specs selector-only, NOT exempt
- 35 specs unknown (no data, no selector — likely use custom helpers)
- Total: 114 specs to either upgrade or exempt

## Disposition triage required (per spec)

Read each remaining spec and assign one of:
1. **UPGRADE** — high-value user journey; add waitForResponse + data assertions. ~10 minutes per spec.
2. **EXEMPT** — genuinely UI-only (404 page, empty-state copy, marketing route, etc.). Add top-of-file `// @selector-only-ok: <reason>`. ~1 minute per spec.
3. **HELPER-WRAPS-ASSERTIONS** — spec uses a custom assertion helper that the audit regex doesn't recognize. Either inline a sentinel comment or refactor helpers to expose recognized patterns. ~5 minutes per spec.

Effort estimate (realistic): 79 × 8min + 35 × 5min = ~10 dev-days. Run as its own milestone after current hardening branch lands.

## Execution
Plan: `~/.claude/plans/e2e-depth-completion.md`.

## CI status
Depth gate is committed but NOT wired into `.github/workflows/`. Wiring happens in Wave 7 when blockers = 0 (after this handoff plan executes).
