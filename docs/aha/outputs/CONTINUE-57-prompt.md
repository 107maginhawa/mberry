# Continuation prompt — CONTINUE-57 (EXECUTE Phases 3-6: fix the TRUE e2e backlog, shard CI, STOP before merge)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-57-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Todolist (after clear)

1. **Phase 3a — guard/permission cluster (~13, likely 1-2 root causes).** Confirm intended
   behavior FIRST: should the frontend redirect a non-officer away from `/officer/*`? Read the
   route-guard code, decide, then fix guard OR test expectation. Covers `officer/guard-enforcement`
   ×3, `states/* permission-error` ×~8, `security.spec.ts:21`. Re-verify on fresh DB. Commit.
2. **Phase 3b — journey URL cluster (~5, likely 1 fix).** `journeys/{navigation,secretary,society-
   officer,treasurer}-journey` + navigation `toHaveURL` after "accesses officer dashboard". One
   shared helper/expectation. Fix, re-verify, commit.
3. **Phase 3c — UI-selector drift (mechanical, fan-out-able).** Update selectors to current DOM:
   `My Dues`/`dues configuration` headings, `Send Reminders`, `Export My Data` card, Delete Account
   card, upload-dialog button, etc. Re-verify each batch on fresh DB. Commit.
4. **Phase 3d — genuine bugs via TDD.** a11y ×2 (`states/dues-states:128`, `states/credits-states:102`
   critical/serious). `auth.spec.ts:91` sign-in data `not.toBeNull()` — verify. TDD on any handler.
5. **Phase 3e — config/excludes.** Add `**/stubs/**` to the chromium+mobile project `testIgnore`
   (global is overridden → stubs run + fail). Decide Mailpit-in-local for `auth/password-reset` (CI
   has it). Update `_visual` baseline if the member-dashboard diff is intended.
6. **Phase 4 — G10 isolated-fixture adoption (CONDITIONAL).** Only for data-presence specs that fail
   because a sibling spec mutated the shared seeded org. Endpoint `/test/isolated-fixture` ALREADY
   exists (`handlers/test-isolation.ts`) + helper `helpers/isolated-fixture.ts`. Adopt
   `withIsolatedFixture(test,…)` per offending spec. Migration **0073** only if schema touched
   (hand-write, idempotent+journal, NO `db:generate`). Then `workers` can exceed 2.
7. **Phase 5 — decouple coverage-gate + shard CI.** `.github/workflows/ci.yml`: change
   `coverage-gate` `needs:[lint-typecheck,e2e]` → `needs:[lint-typecheck]` (L~410). Shard
   `e2e-memberry` matrix `shard:[1..6]` (`bunx playwright test --shard=N/6`, own postgres+minio+API+
   app each, `fail-fast:false`, workers=2/shard) + `e2e-admin` (workers=1) + aggregator job **named
   `e2e`** (`if:always()`, `needs:[e2e-memberry-*, e2e-admin]`, fails unless all pass). **Do NOT rename
   `e2e`** — `ci-gate` (L~516, checks `needs.e2e.result` ~L545) + `coverage-gate` depend on it. Keep
   the Phase-0 `SESSION_LIMIT=100000` in each shard's API env. Tradeoff (accepted): ~6-7× CI minutes.
8. **Phase 6 — verify + handoff.** Watch `gh pr checks 8` until `e2e` (aggregator) + `coverage-gate`
   green and suite < 30 min. Append dated note to PR #8. **STOP before merge unless user says merge.**

**One STOP gate remains: before merge (Phase 6).**
Untouched (need USER/settings): `Deploy` ghcr push perms (org→Packages toggle, infra not code);
G2 elections position-identity model (FK vs jsonb) + Q1 documents card-verify token format (P0 product
decisions, independent of e2e — list as blockers, do not implement).

---

## Where we are (CONTINUE-56 Phases 0-2 DONE — committed, cascade ELIMINATED)

Branch `aha/continue-49-subscription-billing` (PR #8 vs main). Two commits landed this session:

- **`8a470bcb` Phase 0** — `SESSION_LIMIT=100000` for the TEST API only (`.github/workflows/ci.yml`
  e2e job env + `apps/memberry/playwright.config.ts` API webServer `env`). Prod stays 5
  (`core/config.ts SESSION_LIMIT: intish(5)`). Verified: curl repro, oldest cookie survives 6
  sign-ins → 200 (was 401 at limit 5, V-15 evicts oldest).
- **`3ff85e20` Phase 1** — durable **per-test fresh auth**. New `apps/memberry/tests/e2e/helpers/
  programmatic-auth.ts` `freshAuthState(role)` (POST `/auth/sign-in/email` via Playwright
  APIRequestContext → fresh storageState object). `helpers/test-fixture.ts`: new `authRole` option
  overriding the `storageState` fixture (depends on `authRole`, not on itself → no recursion;
  default `context` keeps device emulation). Migrated **69 specs**: `test.use({ storageState:
  authStateFile('X') })` → `test.use({ authRole: 'X' })`; inline `newContext({ storageState:
  authStateFile('X') })` → `newContext({ storageState: await freshAuthState('X') })`. Deleted
  `auth.setup.ts` + the `setup` project. `auth-state.ts` retained for the `AuthRole` type (+ stubs).
  Durability: a role/term/membership mutation in spec N can no longer 401 spec N+1; V-15 can't evict
  an in-use session. Direct-HTTP proof: fresh officer session → 200 on `/accredited-providers/:org`
  (the CONTINUE-55 President-gated probe).

**Phase 2 measurement (STOP gate passed — GO given 2026-06-14):** full memberry suite, FRESH DB
(drop+recreate `monobase` → migrate-on-boot → seed), SESSION_LIMIT override, workers=2, uncapped:
**508 passed / 128 failed / 79 skipped (16.9 min), 0 freshAuthState/sign-in failures → cascade GONE.**
CONTINUE-55's "259" was ~half cascade inflation. **TRUE backlog = 118 real** (10 stub fails excluded).
Full report + per-spec manifest + split: **`docs/aha/outputs/CONTINUE-56-phase2-measurement.md`**.

Split (118 real): ~88 UI-drift/data-presence · ~13 guard/permission cluster · ~5 journey `toHaveURL`
· a11y ×2 genuine · rest env/visual/stub excludes. **Many cluster on shared root causes (≪118 fixes).**

## Ground rules (CONTINUE-52/56, unchanged)
- Work ON the current branch `aha/continue-49-subscription-billing` (PR #8) — **do NOT push to main**.
  TDD where you change handlers; **no fake-green**. Re-verify each fix on a FRESH DB before "green".
- Migrations hand-written, next **0073**, idempotent + journal (do NOT `db:generate`). Never edit
  `generated/**` except migrations.
- Preserve the dirty tree (untracked `docs/aha/outputs/*.md`); no destructive git. Pre-commit hook
  passes **without** `--no-verify` (typecheck + lint-staged + ui-check). End commits with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Playwright `use()` in a fixture trips `react-hooks/rules-of-hooks` → add the
  `// eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture` comment (see
  `helpers/test-fixture.ts`).
- **No heavy bash (psql/grep/builds) DURING an e2e timing run** — concurrent load causes false
  `toBeVisible` timeouts. Quiet machine. `check:sdk-compat` exits 1 BY DESIGN; `db:generate` exits 127
  in Quality Gates (benign).

## Stack state (left running for Phase 3)
- API on **7213** booted with `SESSION_LIMIT=100000` (`cd services/api-ts && SESSION_LIMIT=100000 bun dev`).
- App on **3004** (`cd apps/memberry && bun dev`).
- DB `monobase`: freshly dropped+migrated+seeded (43 users, 130 tables). For a clean re-measure:
  `psql … DROP DATABASE monobase WITH (FORCE); CREATE DATABASE monobase;` → reboot API (migrates) →
  `cd services/api-ts && bun run db:seed`.
- Probe: officer `test@memberry.ph` / `TestPass123!`; President-gated `GET /accredited-providers/
  ed8e3a96-8126-4341-be42-e6eb7940c562` → 200.

## Definition of done (Phases 3-6)
- e2e CI **green** (full memberry + admin < 30 min, fresh DB), **durable** (per-test fresh auth +
  SESSION_LIMIT override). `coverage-gate` no longer skipped by e2e. All other gates green. Dated note
  on PR #8. **STOP before merge.**
