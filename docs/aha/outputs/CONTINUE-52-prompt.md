# Continuation prompt — CONTINUE-52 (make e2e a real, fast, green gate)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-52-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-51 done)

Branch **`aha/continue-49-subscription-billing`**, **PR #8** vs `main`
(https://github.com/eladventures/memberry/pull/8). Latest commit **`a0c1b129`**
(`fix(communication): cross-org cron query for scheduled announcements`).

CONTINUE-51 outcome:
- **Announcement empty-org 500 FIXED + pushed + verified.** Root cause was the
  `communication.processScheduled` **cron** calling `repo.list('', {status:'scheduled'})`
  every 5 min → `eq(organization_id,'')` → `invalid input syntax for type uuid: ""`.
  Fix: non-org-scoped `CommunicationsRepository.findScheduledDue(limit)` + cron repoint +
  `list()` empty-org guard + DB-integration test. Live-verified 0 uuid errors.
- **Gating decided (user): do NOT block PR #8 on e2e.** `e2e` is **not a required check**
  (branch protection unavailable on this repo plan); PR is `MERGEABLE`. All other gates green
  (contract×2, unit, build-api, build-frontends, lint-typecheck, new-code-gate, artifact-smoke,
  gates/Quality-Gates, coverage-gate green-when-run). Merge handed to the user.

## THE TASK — turn e2e into a real gate: fast AND green

e2e currently **times out at 30 min** and was masking a **pre-existing failure backlog** that
CI had never reached. Three sub-problems, do in this order:

### 1. Per-test auth + state isolation (the actual driver — NOT dirty data)
CORRECTION (CONTINUE-51 follow-up): a fresh-DB run **disproved** dirty data as the cause —
clean DB (5 announcements / 2 orgs) failed **259/721**, ~identical to the polluted run's 257,
and officer/ run **serially** (1 worker) still failed **73/151**. So it is **not** parallel
contamination and **not** stale data. The driver is **run length**: deep into a 25-46 min run,
officer API calls start returning 403 and pages stop rendering, while every feature passes in
isolation (officer/roster 12/12). Root cause is **session/auth + shared-seed-state degrading
across the run** — `global-setup.ts` resets once at start, never per-test, and the storageState
auth is captured once. FIX: refresh auth per spec/file (don't reuse one long-lived storageState)
AND isolate mutable seed state per test (the G10 `/test/seed-isolated` idea). DB-pollution is a
side issue, not the driver. Context: the dev DB `monobase` is also polluted (100+ junk orgs,
360+ junk announcements); `tests/e2e/global-setup.ts` only restores **2 org rows +
association baseline** — it does NOT purge accumulated junk. So data-presence / data-count
assertions pass on a fresh CI DB but rot over time. The config comment already points at the
fix: **G10 — per-test seed isolation via a `/test/seed-isolated` endpoint**
(`apps/memberry/playwright.config.ts`, the `workers:2` comment;
`docs/audits/E2E_REMEDIATION_FINAL.md §Parallel contamination`). Land that so specs don't
depend on a pristine global DB, then `workers` can safely go above 2.

### 2. Triage the pre-existing failure backlog (specs CI never ran)
Run the full suite on a FRESH DB and fix real failures. Known offenders (reproduce in
isolation, `--workers=1 --max-failures=100`):
- `tests/e2e/officer/communications.spec.ts` — `:55` status-badge text, `:72` create→detail→publish,
  `:135` `"Back to Communications"` back-link text (selector/UI drift).
- `tests/e2e/journeys/communication-delivery.spec.ts` — `:12/:36/:70/:86` all read
  `/org/$ORG_ID/officer/communications` and assert announcement/notification text visible
  (mix of UI drift + dirty-DB data-presence).
- Sweep the rest of `officer/*`, `member/*`, `journeys/*`, `states/*` — these are the specs
  CI never reached (it always timed out in the first ~157 alphabetical tests).
- NOTE: hardcoded `const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'` (PDA Metro Manila
  Chapter) is the seeded org — it exists; not the problem. Failures are UI-selector drift +
  data assumptions, **not** the CONTINUE-51 backend diff (proven independent).

### 3. Cut wall-clock < 30 min via sharding (only worth it once #1/#2 land)
Full memberry = 143 spec files / 721 tests, ~46 min local @ workers=2, ~2× in CI
(CI ≈ 5.8 tests/min; setup only ~2.8 min). Shard into a matrix so each shard is an
**independent job with its own postgres service + API + app** (preserves the workers=2
anti-contamination property per shard, adds throughput across shards):
- `e2e-memberry` (matrix `shard: [1..6]`, `fail-fast: false`) → `bunx playwright test --shard=${{matrix.shard}}/6`
- `e2e-admin` (8 specs, workers=1) as its own job
- keep an aggregator job **named `e2e`** (`if: always()`, `needs: [e2e-memberry, e2e-admin]`,
  fails unless both succeeded) so `ci-gate` (L516) + `coverage-gate` (L407, `needs: [...,e2e]`)
  keep working. **Do not rename `e2e`** or those gates break.
- Tradeoff (already accepted as follow-up): ~6-7× CI minutes per run.

### Also fix: decouple `coverage-gate` from `e2e`
`coverage-gate` (`.github/workflows/ci.yml` L407, `needs: [lint-typecheck, e2e]`) gets
**skipped** whenever e2e times out — a real gate (BR coverage + CSRF drift) silently not
running. Drop `e2e` from its `needs` (its checks pass locally and don't depend on e2e).

### Ground rules (unchanged)
- TDD where you change handlers; **no fake-green**. Migrations hand-written, next **0073**,
  idempotent + journal (do NOT `db:generate`). Never edit `generated/**` except migrations.
- Preserve the dirty tree; **no destructive git**. Commit on the branch; pre-commit hook
  passes WITHOUT `--no-verify`. End commits with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Push to the branch (PR #8); do
  NOT push to `main`.
- `check:sdk-compat` exits 1 BY DESIGN. `db:generate` exits 127 in Quality Gates (benign).
- Re-verify each fix on a FRESH DB before claiming green. After a batch, push and watch
  `gh pr checks 8`.
- LESSON FROM CONTINUE-51: do NOT run psql/greps/other heavy commands DURING a timing/e2e
  run — concurrent load on the box caused ~257 false `toBeVisible` timeouts in a full local
  run that all passed when re-run in isolation. Run the suite on a quiet machine.

### Definition of done
- e2e CI **green** (full memberry + admin complete < 30 min on a fresh DB), with per-test DB
  isolation so it stays green. `coverage-gate` no longer skipped by e2e. All other gates green.
- Append a dated note to PR #8. STOP before merge unless the user says merge.
