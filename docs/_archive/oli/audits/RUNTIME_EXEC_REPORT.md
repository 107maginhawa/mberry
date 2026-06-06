---
oli-version: "1.0"
dimension: runtime
sub-check: executor
based-on: map@3f0dae76
inputs:
  - docs/audits/runtime/runtime-exec-results.json (commit 343fcf05, contract_version 6)
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json (v6, 147 routes)
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json
  - apps/memberry/tests/e2e/oli-runtime-loop.spec.ts
  - apps/memberry/tests/e2e/oli-runtime.config.ts
last-modified: 2026-06-03T08:21:14Z
last-modified-by: /oli-check --regenerate-dim-reports --auto
tier: Tier-3 (Full FE↔BE, promoted-from-evidence)
tier-1: skipped (auto_run_tier_1_2: false)
tier-2: skipped (auto_run_tier_1_2: false)
map-version: 6
tier-3-source-commit: 343fcf05
tier-3-run-timestamp: 2026-06-03T13:40:14+08:00
verdict: PASS
---

# Runtime Execution Report — `--live` interaction loop

Tier-3 evidence promoted from commit `343fcf05` (2026-06-03 13:40 PHT). Live runtime walker executed end-to-end against the memberry stack. **0 ER-P0 / 0 ER-P1 acceptance hit** — verdict PASS.

## Run Context

| Field | Value |
|---|---|
| HEAD commit | `3f0dae76` |
| Map sha | `map@3f0dae76` (FRESH) |
| Tier-3 evidence file | `docs/audits/runtime/runtime-exec-results.json` |
| Tier-3 source commit | `343fcf05` |
| Tier-3 run timestamp | 2026-06-03T13:40:14+08:00 (~13:40 PHT) |
| Tier-3 contract version | 6 |
| Promotion timestamp | 2026-06-03T08:21:14Z |
| Promotion cycle | `/oli-check --regenerate-dim-reports --auto` |
| Delta `343fcf05` → `3f0dae76` | **doc-only** (audit/report ratchets, no source delta affecting runtime behavior) — tier-3 evidence remains representative of HEAD |
| Prior snapshot | 2026-05-31T15:42:01Z (map v5, WARN) — **REPLACED** |

## Tier Execution Results

### Tier-1 boot-smoke

**Status: skipped (auto_run_tier_1_2=false in `.oli/config.json`)**

`.oli/config.json` does not set `auto_run_tier_1_2: true`, so tier-1 boot-smoke (headless `bun dev` probes of `apps/memberry`, `apps/admin`, `services/api-ts`) was NOT executed by the aggregator on this cycle. To opt in, add `"auto_run_tier_1_2": true` to `.oli/config.json` (per CHECK_LEARNINGS row 18 remediation path a).

### Tier-2 plan refresh

**Status: refreshed**

`docs/audits/RUNTIME_TEST_PLAN.md` regenerated against the current FRESH-ENOUGH map (CODE_ROUTE_MAP v6, 147 routes; CODE_API_SURFACE 471 endpoints) by `oli-runtime-plan --auto --refresh`. Emit mode: **Full FE↔BE walker** (CODE_COMPONENT_REGISTRY present with `api_calls` + `loading_state_hygiene` + `interaction_hygiene` + `hrefs`).

### Tier-3 promoted-evidence summary

**Status: promoted from commit 343fcf05 (no re-run — evidence newer than prior snapshot).**

| Bucket | Count |
|---|---|
| pass | 209 |
| fail | 24 |
| **Total** | **233** |
| **ER-P0** | **0** |
| **ER-P1** | **0** |
| ER-P2 | 1 |
| ER-P3 | 23 |

Per CHECK_LEARNINGS row 18 remediation path b (promote-from-evidence), the aggregator now promotes the on-disk `runtime-exec-results.json` whenever it is newer than the current report — closing the 3-day, 60+-commit staleness gap reported in the prior cycle.

## Findings — top 10

### ER-P2 (1)

| Sev | Route | Detail |
|---|---|---|
| P2 | `/_authenticated/my/billing` | `GET /api/billing/merchant-accounts/me` returns 404 — bare-`:me` endpoint missing on BE (same class as P3-17 residuals) |

### ER-P3 (23) — top 9 by route

| Sev | Kind | Detail |
|---|---|---|
| P3 | skip | page-load `/associations/$associationId` (unresolved param) |
| P3 | skip | page-load `/members/$personId` (unresolved param) |
| P3 | skip | page-load `/organizations/$organizationId` (unresolved param) |
| P3 | skip | page-load `/events/$eventSlug` (unresolved param) |
| P3 | skip | page-load `/invite/$token` (unresolved param) |
| P3 | skip | page-load `/pay/$token` (unresolved param) |
| P3 | skip | page-load `/verify/$certificateNumber` (unresolved param) |
| P3 | skip | page-load `/verify/$credentialNumber` (unresolved param) |
| P3 | skip | page-load `/verify/$token` (unresolved param) |

Root cause for all P3 skips: **auth adapter param-discovery needs widening**. The seed dataset (841 persons) does not surface deterministic IDs for the dynamic-param routes through the runner's pre-flight resolver. Non-blocking — these are advisory skips, not failures of the route under test.

## Wave 61 Route Coverage (in promoted snapshot)

| Wave 61 route | In CODE_ROUTE_MAP v6? | In tier-3 scope? | Result |
|---|---|---|---|
| `/_authenticated/my/surveys/` | yes | yes | **pass** |
| `/_authenticated/my/surveys/$surveyId` | yes | yes | P3 skip (unresolved `$surveyId`) |
| `/_authenticated/org/$orgSlug/officer/surveys/` | yes | yes | **pass** |
| `/_authenticated/org/$orgSlug/officer/surveys/$surveyId` (re-edit) | yes | yes | P3 skip (unresolved `$surveyId`) |
| `/_authenticated/org/$orgSlug/officer/surveys/new` | yes | yes | **pass** |
| `/association/member/credits/adjust` (officer interaction) | n/a — interaction, not a top-level route | covered via `/_authenticated/org/$orgSlug/officer/reports/credits` page-load + mutation walk | **pass** |
| poll (inline component) | n/a — not a top-level route | covered via parent route page-loads | **pass** (no inline poll regressions in run) |

All three Wave 61 surfaces appear in the v6 route map and were exercised in the tier-3 run. No ER-P0/P1 findings against any Wave 61 surface.

## Verdict — PASS

Acceptance rule: **PASS iff ER-P0 = 0 AND ER-P1 = 0**.

Tier-3 totals: P0=0, P1=0 → **PASS** (per acceptance gate; commit `343fcf05` message corroborates: "0 ER-P0 / 0 ER-P1 acceptance hit"). Replaces prior WARN carried from the 2026-05-31 snapshot (map v5).

P2 (1) and P3 (23) are advisory and do not block the runtime dimension. They feed forward as:
- P2 → backlog item on `/api/billing/merchant-accounts/me` bare-`:me` endpoint
- P3 (23) → backlog item on auth adapter param-discovery widening

## What's Next

- P2 fix: implement `GET /api/billing/merchant-accounts/me` (bare-`:me` form) — class match P3-17 residuals
- P3 fix: widen the runner's auth-adapter param-discovery to deterministically resolve `$id`/`$token` from seed fixtures
- Re-run with `/oli-check --runtime --live` after either fix lands to confirm regressions on detail-page routes
