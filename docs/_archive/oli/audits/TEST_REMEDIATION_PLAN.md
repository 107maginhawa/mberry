# Test Coverage Audit + Remediation Plan

> Reference copy of approved plan. Source: `~/.claude/plans/can-you-address-all-playful-feigenbaum.md`
> Approved: 2026-06-04

## Context

User asked: are all tests working, do all use cases have tests (BE + FE), can E2E be done thoroughly. Exploration found:

- **Backend strong**: 549 unit tests, 99 Hurl contracts, 13 integration. All 27 handler modules covered. Confidence Phase 1+2 done. ~6 fixture residuals lingering.
- **Frontend weak**: 17 unit tests in `apps/memberry`, 2 in `apps/admin`. Modules m04, m06, m07, m08, m11 regressed per `docs/audits/CONFIDENCE_REPORT.md`.
- **E2E persona-organized, route-blind**: 42 Playwright specs. 128 routes in memberry — coverage is persona-implicit. 81/107 documented user flows tested. Pinned Playwright 1.58.2.
- **Canonical use-case sources exist**: `docs/ver-3/business/br-registry.json` (40 BRs, 32 Phase 1 done), `docs/product/WORKFLOW_MAP.md` (107 flows × 6 personas), `docs/product/modules/` (M01–M22).

Goal: three sequenced audits with full remediation. Highest E2E bar (persona + route + cross-persona + visual regression + a11y). Aggressive FE component backfill for the five regressed modules.

---

## Phase 1 — Health Check (are tests green NOW)

### 1.1 Run everything, capture state
- `cd services/api-ts && bun test 2>&1 | tee .audits/be-unit.log`
- `cd specs/api && bun run test:contract 2>&1 | tee .audits/contract.log` (boots api-ts on 7213)
- `cd services/api-ts && bun test src/tests/ 2>&1 | tee .audits/integration.log`
- `cd apps/memberry && bun run test:e2e 2>&1 | tee .audits/e2e-memberry.log`
- `cd apps/admin && bun run test:e2e 2>&1 | tee .audits/e2e-admin.log`
- `bun run --filter=@monobase/* test` for FE unit (Vitest)
- `bun run typecheck` per workspace

### 1.2 Classify failures
Write `docs/audits/HEALTH_CHECK.md`:
- Hard fails, flakes, fixture residuals, skips/fixmes, type errors

### 1.3 Fix everything red
- Atomic commits per fix. Root-cause flakes per `feedback_root_cause_layers`.

**Exit gate**: zero red across all suites.

---

## Phase 2 — Coverage Gap Matrix (BR + Flow + Route)

### 2.1 Build three matrices via `scripts/audit/coverage-matrix.ts`
- Matrix A: BR → test (parse br-registry.json, grep BR-NN refs)
- Matrix B: Flow → E2E spec (parse WORKFLOW_MAP.md)
- Matrix C: Route → page.goto (walk routes/, grep e2e)

### 2.2 Write `docs/audits/COVERAGE_MATRIX.md`
- 32/32 Phase 1 BRs with BE+E2E+contract refs
- 107/107 flows (5 unimplemented journeys flagged feature-missing)
- 128/128 routes visited

### 2.3 Backfill gaps
- BR missing BE test → handler test referencing BR-NN
- BR missing contract → Hurl per /contract-scaffold
- Flow missing E2E → Playwright spec under persona folder
- Route missing visit → add to existing or new route-smoke spec

### 2.4 CI gates in `.github/workflows/ci.yml`
- `coverage-matrix` job (fails if <100% Phase 1)
- `br-allowlist` job (BR refs must match registry)

**Exit gate**: 100% Phase 1 coverage, CI gates merged.

---

## Phase 3 — E2E Quality + FE Backfill + Visual + a11y

### 3.1 E2E depth audit (42 specs)
Classify shallow / selector-bound / real flow → rewrite as needed. Write `docs/audits/E2E_QUALITY.md`.

### 3.2 Click-through gate
`apps/memberry/tests/e2e/_click-through.spec.ts` per persona. Fail on console errors, 5xx, blank states.

### 3.3 Cross-persona specs under `apps/memberry/tests/e2e/cross-persona/`
- officer-approves-member-application (P5→P6)
- treasurer-records-dues-member-sees-receipt (P3→P6)
- secretary-creates-event-member-rsvps-officer-sees-roster (P4→P6→P2)
- admin-suspends-org-member-sees-lockout (P1→P6)
- president-runs-election-members-vote-secretary-tallies (P2→P6→P4)

Real DB seeds, real WebSocket, no cross-persona mocking.

### 3.4 FE component backfill (m04, m06, m07, m08, m11)
Per regressed module:
- Vitest per component (render, props, interaction, error/loading/empty)
- Vitest per hook (state, transitions, error)
- Vitest per form (each Zod refinement, submit success/error)
- Vitest per data table (sort, filter, pagination, empty, error)

Co-locate `<Component>.test.tsx`. testing-library/react + Vitest. ~200 files.

### 3.5 Visual regression
- `@playwright/test toHaveScreenshot` baselines per key route (~30)
- `apps/memberry/tests/visual/` directory
- `maxDiffPixelRatio: 0.02`
- CI: store baselines, fail on diff, upload artifacts. Manual `--update-snapshots`.

### 3.6 Accessibility
- Install `@axe-core/playwright`
- `_a11y.spec.ts` per app iterating routes
- Hard-fail serious/critical; soft moderate

### 3.7 Stabilization
- `--repeat-each=3` nightly smoke
- `docs/audits/E2E_FLAKE_LOG.md`
- >1% flake → root-cause fix

**Exit gate**:
- 100% E2E depth = real flow
- Click-through green per persona
- 5 cross-persona green
- 200+ FE Vitest, m04-m11 regression cleared
- Visual baselines committed, axe job green

---

## Verification

```
bun run --filter=* typecheck
bun run --filter=* test
bun run test:contract
cd apps/memberry && bun run test:e2e
cd apps/admin && bun run test:e2e
bun scripts/audit/coverage-matrix.ts --gate
```

Regenerate CONFIDENCE_REPORT.md, confirm m04/m06/m07/m08/m11 graduate to adequate.

## Estimate

Phase 1: 1–2 days. Phase 2: 4–6 days. Phase 3: 10–14 days. Total ~3 weeks.
