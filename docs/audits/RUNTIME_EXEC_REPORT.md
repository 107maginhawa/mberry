---
oli-version: "1.0"
dimension: runtime
sub-check: executor
based-on:
  - apps/memberry/tests/e2e/oli-runtime-loop.spec.ts
  - apps/memberry/tests/e2e/oli-runtime.config.ts
  - docs/audits/runtime/runtime-exec-results.json
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json
last-modified: 2026-05-31T15:42:01Z
last-modified-by: oli-check --runtime --live
tier: Tier-3 (full)
map-version: 5
verdict: WARN
---

# Runtime Execution Report — `--live` interaction loop

The one place OLI drives a real browser. Generated data-driven Playwright runner executed headless against the running app (Memberry @ http://localhost:3004, API @ 7213), signed in as the seed member, built the target matrix from `CODE_*` maps (v5 → Tier-3 full eligible), and asserted per interaction.

**Verdict: WARN** — 0 app-origin P0/P1; 1 ER-P1 is a runner-exception locator flake (needs re-verify), 21 P3 are legitimate unresolved-param skips.

## Run Context

| Field | Value |
|-------|-------|
| Framework | React + TanStack Router (file-based) — supported |
| Map version | 5 (engine) → Tier-3 full |
| Map freshness | STALE-OVERLAP → `RUNTIME: stale-map` WARN (5 working-tree files newer than map) |
| Auth | `signInAsMember` (seed member); officer-only params intentionally NOT seeded |
| dataSurfaces | `[]` — click-only actions (download, Pay Dues) NOT exercised live |
| Targets | 239 (109 page-load + 108 nav-links + 21 skip + 1 nav-links exception) |

## Results

| Outcome | Count |
|---------|-------|
| Pass | 217 |
| Fail | 22 |
| P0 | 0 |
| P1 | 1 |
| P2 | 0 |
| P3 | 21 |

Breakdown: `page-load:pass` 109, `nav-links:pass` 108, `nav-links:P1:fail` 1, `skip:P3:fail` 21.

## P1 — Runner Exception (NOT an app defect)

```
route: /_authenticated/my/payments
kind:  nav-links
detail: runner exception: locator.getAttribute: Timeout 10000ms exceeded
        waiting for locator('a[href], [role="link"]').nth(22)
```
The runner iterated nav links and the 23rd link detached/never resolved within the 10s getAttribute timeout. This is a Playwright locator flake in the runner's own nav-link walk, not a JS error / 4xx / dead route in the app. **Action: re-run to confirm.** Does NOT change the GATE (real static P0/P1 already force BLOCK regardless).

## P3 — Unresolved-param skips (legitimate ⊘)

21 targets skipped: dynamic-param routes (officer-only and detail routes) whose params were not seeded for the member persona (`-UNRESOLVED`). Expected and honest — the member auth adapter intentionally does not mint officer-scoped IDs. Advisory only.

## What the live run did NOT cover

- **Click actions**: `dataSurfaces` is empty, so download buttons, Pay Dues, dialog/sheet openers were never clicked. The J-ORG-001 P0 (dead download endpoint) and J-MY-001 P1 (Pay Dues noop) are click-only and were caught by static analysis, not here.
- **Officer surfaces**: not signed in as officer → officer routes either skipped (unresolved param) or loaded without officer data.

This is recorded explicitly so the green page-load/nav signal is NOT read as a clean bill of health.

## ER- ↔ J- Reconciliation

No `ER-` finding keys to a static `J-` finding this run (key = `file_path + violation_category`). The executor's pass set neither confirms nor refutes the static P0/P1 (different action class). Per the upgrade rule, an ER- that confirms a same-category static finding would upgrade it — none did.

## Empirical backstop note (R1-strict)

0 app-origin ER-P0/P1 across 109 loaded routes is a strong empirical signal but is NOT a sufficient backstop to clear the WARN-WITH-PROOF floor for the OVERALL run, because the in-scope routes for the degrade include click-only and officer surfaces the executor did not exercise. The overall verdict is driven by the verified static P0/P1 → BLOCK.
