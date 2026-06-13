# Continuation prompt — CONTINUE-51 (make e2e green on PR #8; then merge decision)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-51-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-50 done; contract CI GREEN)

Branch **`aha/continue-49-subscription-billing`**, **PR #8** vs `main`
(https://github.com/eladventures/memberry/pull/8). The 23 bundled-backlog contract-CI
failures are **fixed → both `contract` checks PASS (155/0)**. Latest commit `fd489451`.

CONTINUE-50 commits (newest first): `fd489451` (cap Schemathesis step), `1b3cf204`
(PAYMENT_TOKEN_SECRET in CI), `60c941f9` (the 23-failure fixes: env, dues enum, org_id,
audit user_type helper + migration 0072 joined_at default, RBAC repoint to VP, CSRF
inject). The PR #8 body has the full dated triage table.

### Latest CI on PR #8 — gate status
GREEN: **contract ×2, gates (Quality Gates), coverage-gate, lint-typecheck, unit-tests,
build-api, build-frontends, new-code-gate, artifact-smoke.**
RED: **e2e** — times out at its 30-min budget.

## THE TASK — make `e2e` green (or make a clear gating decision)

`e2e` (the `ci.yml` `e2e` job) is **NOT a contract failure** and was never green on this
branch (pre-existing backlog). From the last run's log: **0 Playwright `✘`** before the
30-min kill — it just **can't finish**. Two compounding causes:

1. **Volume**: `Running 721 tests using 2 workers` (ci.yml e2e: `cd apps/memberry && bun
   run test:e2e`, then admin e2e too). At the observed rate (~157 ✓ in 30 min) it physically
   cannot complete in `timeout-minutes: 30`.
2. **A real 500 inflating retries**: the API logged, repeatedly during e2e,
   `ERROR: invalid input syntax for type uuid: ""` on
   `select ... from "announcement" where ("announcement"."organization_id" = $1 ...)` with
   `$1 = ''`. Some announcement handler runs with an **empty org id** → 500 → Playwright CI
   retries (2x) → wasted wall-clock. Same bug class as the CONTINUE-50 `org_id` fix.

### Suggested task list (add to TodoWrite / TaskCreate)
1. **Decide e2e gating first.** Check whether `e2e` is a *required* status check on PR #8
   (`gh api repos/eladventures/memberry/branches/main/protection` or repo settings). If NOT
   required → the contract-green PR is mergeable now; e2e fix can be a follow-up PR. If
   required → it must go green before merge. Surface this to the user.
2. **Get e2e's TRUE result (un-masked by the timeout).** Boot the stack the way `ci.yml`
   e2e does, then run Playwright locally with a long/normal timeout to see real pass/fail
   counts:
   - API: `cd services/api-ts && bun dev` (port 7213; migrations auto-run; `bun run db:seed`).
   - memberry app: `cd apps/memberry && bun dev` (3004). admin app: `cd apps/admin && bun dev` (3003).
   - `cd apps/memberry && bun run test:e2e` (and `cd apps/admin && bun run test:e2e`).
   - Note: the scratch DB `monobase_ci` from CONTINUE-50 is migrated through 0072 + seeded;
     the persistent dev DB `monobase` is at migration 0071 (apply 0072 on next boot).
   - env that matters (CONTINUE-50): the local `.env` already has
     `AUTH_REQUIRE_EMAIL_VERIFICATION=false`, `AUTH_ADMIN_EMAILS`, `PAYMENT_TOKEN_SECRET`,
     so local e2e isn't blocked by the env cascade CI hit.
3. **Root-cause + fix the `announcement organization_id = ''` 500.** Find the handler/query
   that runs with an empty org id (likely a list/stats announcement endpoint reached before
   org context is set, or a frontend call passing `''`). Guard it (return empty / 400, not a
   uuid-cast 500). TDD where you touch a handler.
4. **Cut e2e wall-clock so it finishes < 30 min.** Options, cheapest first: bump Playwright
   `workers` 2→4 (ubuntu-latest has 4 vCPU), reduce retries for known-stable specs, and/or
   shard e2e across jobs (`--shard`), and/or raise `timeout-minutes`. Verify the full suite
   completes locally/CI.
5. **Re-confirm all gates green + present merge recommendation.** Re-run any flaky job
   (`gates`/coverage-gate flaked once on `test:coverage:gate` — passes locally). Append a
   dated note to PR #8. **STOP before merging — recommend, don't merge, without the user.**

### Ground rules (unchanged from CONTINUE-50)
- TDD where you change handlers; **no fake-green**. Migrations hand-written, next **0073**,
  idempotent + journal (do NOT `db:generate`). Never edit `generated/**` except migrations.
- Preserve the dirty tree; **no destructive git**. Commit on the branch; pre-commit hook
  passes WITHOUT `--no-verify`. End commits with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Push to the branch (PR #8); do
  NOT push to `main`.
- `check:sdk-compat` exits 1 BY DESIGN (don't `--update` until milestone Step 6).
  `db:generate` exits 127 in Quality Gates (`with-esbuild-wasm.sh` missing) but is swallowed
  by `generate.ts` ("tracked separately") — benign, not your task.
- Re-verify each fix locally (boot stack + re-run the affected e2e specs) before claiming
  green. After a batch, push and watch `gh pr checks 8`.

### Definition of done
- e2e CI green (full 721+ memberry + admin specs complete within budget), OR a clear,
  user-approved gating decision (fix-now vs follow-up vs adjust the gate) with the
  `announcement` 500 fixed regardless.
- All other gates stay green. Append a dated note to PR #8. STOP before merge.

execute systematically — decide e2e gating, get the un-masked e2e result, fix the
announcement empty-org-id 500, cut e2e wall-clock; verify before claiming done.
