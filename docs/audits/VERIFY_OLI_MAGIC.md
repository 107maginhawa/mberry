---
oli-version: "1.0"
last-modified: 2026-05-30
last-modified-by: verify-oli-magic (claude-opus-4-7)
verifies: docs/audits/CHECK_SUMMARY.md (2026-05-30), docs/audits/BROWNFIELD_STATUS.md, docs/audits/enforce/.baseline.json (v49)
---

# Verify `/oli-magic` Compliance Claim — Live Run Report

**Run date:** 2026-05-30
**Mode:** report-only (no fixes applied)
**Method:** read existing audit artifacts + execute the test gates oli-magic claims pass

## Bottom Line

**Mixed PASS.** The static OLI artifacts (specs, audit reports, AST knowledge graph) are real, current, and self-consistent for **P0/P1 status**. The dynamic gates are **partially green**: typecheck + backend unit + BR coverage pass clean; frontend unit fails 10/646; contract suite is broken at parse (Hurl syntax incompat); Playwright is provably runnable headless but fails on the first scenario against the currently running stale API process.

**Ship verdict per oli-magic graduation criteria:** Backend gates GREEN. Frontend gates YELLOW. Runtime gates RED (storage dep down, contract suite parse error). Do not ship until frontend test files and contract runner are repaired.

## Verdict Table

| Dimension | oli-magic claim (CHECK_SUMMARY 2026-05-30) | Live result | Verdict |
|---|---|---|---|
| P0 open (audit baseline v49) | 0 | `p0_findings: {}`, all 19 modules `P0:0` | **PASS** |
| P1 open (audit baseline) | 0 | all 19 modules `P1:0` | **PASS** |
| Resolved P0/P1/P2 | tracked | 72 P0 / 108 P1 / 113 P2 resolved | **PASS** |
| Monorepo typecheck | claimed clean | `bun run --filter '*' typecheck` exit 0, all 5 workspaces | **PASS** |
| Backend unit tests | 5,461 (Cycle 3) / 535 files claimed pass | **6,013 pass / 0 fail / 21 todo** across 535 files in 22.11s | **PASS** |
| Frontend unit tests (memberry vitest) | "362 / +10 / 372 pass" (BROWNFIELD), 127 in last summary | **636 pass / 10 fail / 4 failed files** (646 total, 97 files), 17.96s | **FAIL** |
| BR coverage gate | 49/49 mapped | **40 COMPLETE / 4 INCOMPLETE / 6 DEFERRED / 1 UNTESTED** (51 BRs total) | **YELLOW** |
| Contract suite (Hurl, 97 scenarios) | claimed green | **Parse error on 1st scenario** (`cookie:` not a valid Hurl option); admin token preflight fails | **FAIL** |
| Headless Playwright runnable | configured | **Confirmed runnable** for both apps; `chromium_headless_shell-1208` spawned (verified via `ps`). memberry: 658 tests detected, 1 fail stop at maxFailures=1, 657 not run (Communications page text missing). admin: 31 tests detected, 3 fail stop at maxFailures=3, 28 not run (all 3 = `page.waitForLoadState('networkidle')` timeout on `/feature-flags`, `/operators`, `/impersonate`). | **PARTIAL** (runnable yes; suite not green) |
| Runtime readiness | implied healthy | `/livez` 200; **`/readyz` 503**: `storage: fail` (db pass, jobs pass) | **FAIL** |
| AST knowledge graph | present | `docs/audits/codebase-map/CODE_{MODULE_MAP,API_SURFACE,COMPONENT_REGISTRY,DATA_FLOW,ROUTE_MAP,STATE_MACHINES,TERMINOLOGY_MAP,IMPORT_GRAPH}.{json,md}` all present, generated 2026-05-29 | **PRESENT** |
| Codebase-map freshness | 2026-05-29 | **STALE.** 35+ commits to `services/api-ts/src/`, `apps/memberry/src/`, `apps/admin/src/` since map regen — including BR-41/BR-43 training guards (eaae7870), Wave 22-56 enforcement fixes, layer-7 seed (44f1eb9a), orphan migration cleanup (a12d3805) | **STALE** |
| BROWNFIELD_STATUS coherent | "GRADUATED" header | **Internal contradiction.** Header (L8) + Cycle-3 Scorecard (L165-173) say GRADUATED with 9.0/9.2/9.0. Footer Graduation Table (L382-394) says NOT GRADUATED with Health 8.2 / Confidence 8.8. Latest oli-check run (CHECK_SUMMARY 2026-05-30) ratifies the GRADUATED reading. File last touched 2026-05-24 — predates 2026-05-30 remediation. | **STALE doc, latest verdict = PASS** |

## What Actually Exists (Inventory)

### OLI artifacts present
- **Spec layer (`docs/product/`):** `MASTER_PRD.md`, `DOMAIN_MODEL.md`, `WORKFLOW_MAP.md`, `MODULE_MAP.md`, `SEED_MANIFEST.md`, **22 MODULE_SPEC.md** files (`modules/m01-…/m22-…/`), plus `API_CONVENTIONS.md`, `EVENT_CONTRACTS.md`, `AUDIT_CONTRACTS.md`, `THREAT_MODEL.md`, `PERFORMANCE.md`, `OBSERVABILITY.md`, `ROLE_PERMISSION_MATRIX.md`, `DOMAIN_GLOSSARY.md`, `ERROR_TAXONOMY.md`, `STATE_MACHINES.md`, `UI_BLUEPRINT.md`, `CONSISTENCY_REPORT.md`, `SPEC_REVIEW.md`, `TRACE_AUDIT_REPORT.md`, `SPEC_COVERAGE_REPORT.md`.
- **Audit layer (`docs/audits/`):** `CHECK_SUMMARY.md` (2026-05-30 01:52), `CONFIDENCE_REPORT.md` (2026-05-30 01:51, rev 2), `COMPLIANCE_REPORT.md` (2026-05-30 01:00, 96%), `STRUCT_AUDIT_REPORT.md` (2026-05-30 01:04, 8.8/10), `ENFORCEMENT_REPORT.md` (82KB, 2026-05-29), `BROWNFIELD_STATUS.md` (2026-05-24), `enforce/.baseline.json` (v49, 2026-05-29).
- **AST knowledge graph (`docs/audits/codebase-map/`):** 8 paired JSON+MD artifacts covering module boundaries, API surface, component registry, data flow, route map, state machines, terminology map, import graph. Generated 2026-05-29 by `oli-codebase-map`.

### Test infrastructure
- **Backend:** 535 `*.test.ts` files under `services/api-ts/src/` (bun test runner, 12,455 assertions).
- **Frontend:** 97 `*.test.tsx` files under `apps/memberry/src/` (Vitest via `scripts/with-esbuild-wasm.sh`).
- **Contract:** 97 `*.hurl` files under `specs/api/tests/contract/`, runner at `scripts/run-contract-tests.ts`.
- **E2E:** Playwright wired for both apps; **headless confirmed runnable** (chromium-headless-shell PID 63475 spawned during this verification). memberry: chromium desktop + 375×812 mobile, baseURL `:3004`. admin: chromium desktop, baseURL `:3003`. webServer auto-spawns API + frontend with `reuseExistingServer: true`. Reporter `json+line+html`. `retain-on-failure` trace/video/screenshot.
- **BR registry:** `docs/ver-3/business/br-registry.json` with 51 BRs; gate at `scripts/br-coverage.ts`.

## Live Run Detail

### Backend unit tests (PASS)
```
6013 pass
21 todo
0 fail
12455 expect() calls
Ran 6034 tests across 535 files. [22.11s]
```
Matches and exceeds CHECK_SUMMARY claim. No regression.

### Frontend unit tests (FAIL)
```
Test Files  4 failed | 93 passed (97)
Tests       10 failed | 636 passed (646)
Duration    17.96s
```
First identified failure: `apps/memberry/src/features/events/components/event-card.test.tsx:115` — `getByLabelText('Event actions')` not found (label changed or removed in component, test not updated). 3 other test files failed; full list available via `bun run test --reporter=verbose`.

> Note: an initial run using bare `bun test` (bun native runner) produced 307 fail / 201 errors due to `vi.mock`/`vi.hoisted` being undefined — that runner cannot replace Vitest. The correct command per `package.json` is `bun run test`, which uses `bash ../../scripts/with-esbuild-wasm.sh vitest run`. The 10-fail figure above is from the correct invocation.

### BR coverage gate (YELLOW)
```
Overall: 51 BRs, 40 COMPLETE, 4 INCOMPLETE, 6 DEFERRED, 1 UNTESTED
PASS: Coverage report complete.
```
Script exits 0 (no hard gate violations), but report flags:
- **UNTESTED:** BR-47 (Banned Users Rejected at Auth Middleware) — 0 backend, 0 contract, 1 E2E only.
- **INCOMPLETE:** BR-43 (Voting Only When Status Is `voting`) — 1 backend, 0 contract, 1 E2E.
- **INCOMPLETE:** BR-48 (Bulk Payment Batch Size Limit) — 1 backend, 0 contract, 0 E2E.
- **INCOMPLETE:** BR-50 (Election Date Ordering DB Constraint) — 1 backend, 0 contract, 1 E2E.
- **INCOMPLETE:** BR-51 (Internal Service Token Timing-Safe) — 1 backend, 0 contract, 0 E2E.
- **DEFERRED (p2-deferred, intentional):** BR-35, 36, 37, 38, 39, 40.
- Missing test files (declared in registry but not on disk):
  - `services/api-ts/src/handlers/training/enroll.test.ts` (BR-02)
  - `services/api-ts/src/handlers/dues/repos/dues.repo.test.ts` (BR-02/04/05/08/30)
  - `services/api-ts/src/handlers/training/markComplete.test.ts` (BR-13)
  - `services/api-ts/src/handlers/training/createTraining.test.ts` (BR-15)
- Stub contract tests (status-code-only): BR-20, BR-29, BR-34.

### Contract suite (FAIL — runner broken)
```
→ 97 contract scenario(s) against http://localhost:7213
⚠ admin preflight failed: could not sign up or sign in as "admin@contract-tests.local"
error: Parsing option
  --> specs/api/tests/contract/assoc-categories-flow.hurl:45:1
   |
45 | cookie:
   | ^ the option name is not valid.
```
Two distinct problems:
1. **Hurl version incompat:** `cookie:` is not a valid Hurl option in the installed version. The `.hurl` files were authored against an older grammar. Cannot validate the contract claim against this codebase until the runner version is reconciled or the scenarios updated.
2. **Admin preflight token unavailable:** `AUTH_ADMIN_EMAILS` is missing `admin@contract-tests.local` on the running impl. Admin-gated scenarios cannot pass.

### Headless Playwright (PARTIAL)
- **Runnable: YES.** During this run, Playwright spawned `chromium_headless_shell-1208` (PID 63475 verified via `ps`). 658 tests discovered for memberry, suite booted, screenshot/video/trace captured on failure.
- **Suite green: NO.** First test stopped suite (`maxFailures=1` in `playwright.config.ts`):
  - `tests/e2e/actions/comms-elections-actions.spec.ts:15:3` — `Communications Actions › announcement list shows real announcements`
  - Locator `main:getByText(/Communications/i)` timed out at 10s. Trace + video at `apps/memberry/test-results/actions-comms-elections-ac-90da3-st-shows-real-announcements-chromium/`.
- Failure is **likely upstream of test logic**: the API process the tests hit is from yesterday (pre-2026-05-30 commits), and `/readyz` reports `storage: fail`. Cannot distinguish "real regression" from "stale runtime" without a fresh API boot.
- **Admin Playwright (completed):** 31 tests detected, suite stopped at `maxFailures=3`. Three failures, all `page.waitForLoadState('networkidle')` 30s timeouts:
  - `tests/e2e/admin-routes.spec.ts:5` — `feature-flags page loads`
  - `tests/e2e/admin-routes.spec.ts:14` — `operators page loads`
  - `tests/e2e/admin-routes.spec.ts:23` — `impersonate page loads`
  - 28 of 31 did not run. Same likely root cause: stale API + `/readyz` storage failure preventing `networkidle` from settling.

### API runtime state (FAIL)
- Process PID 97493 already listening on `:7213` at verification start. Could not restart.
- `/livez` → `200 ok`.
- `/readyz?verbose` → `503 { database: pass, storage: fail, jobs: pass }`.
- Boot log timestamps show start at `2026-05-29` (the running impl predates the 2026-05-30 BR-41/BR-43 + layer-7 seed commits).
- **Storage dep (S3/MinIO) is down or unreachable** — fix `docker-compose.deps.yml` or env wiring before re-running contract/E2E for a definitive green.

### Codebase-map drift (STALE)
- Map regenerated 2026-05-29T16:51:31Z by `oli-codebase-map`.
- Since then, **35+ commits touched source under `services/`, `apps/`, `packages/`, `specs/`**, including (selected):
  - `eaae7870` 2026-05-30 01:48 — feat(training): enforce BR-41 payment gate + BR-43 completion lock
  - `9c17378e` 2026-05-30 01:47 — test(training): add BR-41/BR-43 enrollment gate+lock tests
  - `44f1eb9a` 2026-05-30 01:57 — chore(seed): add layer-7 module coverage seeding
  - `a12d3805` 2026-05-30 01:57 — chore(db): remove stale orphan migrations
  - Waves 20-56 enforcement remediation commits across m02/m03/m06/m08/m09/m11/m12/m14/etc.
- Knowledge-graph consumers (compliance, traceability, enforcement) reading `CODE_*.json` will see pre-remediation state. **Regenerate** before next `/oli-check` or `/oli-magic --update`.

## Reconciled BROWNFIELD_STATUS Verdict

`docs/audits/BROWNFIELD_STATUS.md` contains two graduation tables:
- L165-173 (Cycle 3 Scorecard, Phase B): **GRADUATED**, Health 9.0 / Compliance 9.2 / Confidence 9.0.
- L382-394 (Top-Level Metrics, Cycle 3 Current): **NOT GRADUATED**, Health 8.2 / Confidence 8.8.

These are not a contradiction — they are sequential states within the same Cycle 3 run. L382-394 is the *pre-remediation* score; L165-173 is *post-remediation*. The file is mis-ordered and confusing. **The 2026-05-30 `CHECK_SUMMARY.md` is the authoritative latest verdict (PASS, 9/9/9, traceability WARN on unbuilt-roadmap m13/m15 only).**

Recommendation: rewrite BROWNFIELD_STATUS so the latest scorecard appears at the top, or delete the pre-remediation tables to remove ambiguity.

## What Needs To Happen Next (Not Done — Report Only)

Ordered by ship-blocker severity:

1. **Restore runtime storage dependency** so `/readyz` returns 200. Without this, E2E and contract suites cannot definitively pass against the running impl. Likely `docker-compose -f docker-compose.deps.yml up minio` or equivalent.
2. **Restart API (kill PID 97493) and re-boot from current HEAD** so the 2026-05-30 training BRs + layer-7 seed are live.
3. **Fix Hurl contract runner** — either upgrade `.hurl` syntax to current Hurl grammar (drop `cookie:` option, use `Cookie:` request header) or pin the older Hurl binary. Then ensure `AUTH_ADMIN_EMAILS` contains `admin@contract-tests.local` on the runner impl.
4. **Repair 10 failing frontend unit tests** — start with `apps/memberry/src/features/events/components/event-card.test.tsx:115`. Full list via `cd apps/memberry && bun run test --reporter=verbose`.
5. **Re-run headless Playwright** for both apps end-to-end against the fresh API. Expect storage-dependent specs (documents, certificates, avatar upload) to fail until step 1 is done.
6. **Regenerate the AST knowledge graph** via `/oli-codebase-map` to reflect post-2026-05-30 source state.
7. **Close BR-47 (UNTESTED) and 4 INCOMPLETE BRs** (43, 48, 50, 51) via `/oli-check --enforcement` or targeted TDD per `VERTICAL_TDD.md`.
8. **Reconcile BROWNFIELD_STATUS.md** ordering so the latest verdict is unambiguous.

## Skills To Reuse For Each Remediation Step

| Step | Skill |
|---|---|
| 1, 2 | `/dev-api`, manual `docker compose` |
| 3 | `/test-contract`, `/typespec` (regen) |
| 4 | `/investigate` per failing file, `/test-e2e` |
| 5 | `/qa` or `/test-e2e` |
| 6 | `/oli-codebase-map` |
| 7 | `/oli-check --enforcement`, `/gsd-debug` per BR |
| 8 | manual edit of `BROWNFIELD_STATUS.md` |

## Raw Evidence Paths

- Backend test output: `/private/tmp/claude-501/-Users-elad-mini-Desktop-memberry/<session>/tasks/bzinssrjo.output`
- Frontend test output (correct runner): `…/tasks/b6jreegm7.output`
- Frontend test output (bun native, mis-runner): `…/tasks/by6h4t87t.output`
- Typecheck output: `…/tasks/bohmmuqm3.output`
- BR coverage output: `…/tasks/bihwanqol.output`
- Contract suite output: `…/tasks/boj3rp1ge.output`
- Playwright memberry output: `…/tasks/bzn0h5162.output`
- Playwright admin output (in-flight): `…/tasks/bwlehrzwf.output`
- API boot log: `/tmp/memberry-api-boot.log`
- Playwright failure artifacts: `apps/memberry/test-results/actions-comms-elections-ac-90da3-st-shows-real-announcements-chromium/`
