# Continuation prompt — CONTINUE-50 (triage + fix the 23 bundled-backlog contract-CI failures on PR #8)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-50-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-49 done + on a pushed PR; CI mostly green)

Branch **`aha/continue-49-subscription-billing`** is pushed to origin, **PR #8** open against `main`
(https://github.com/eladventures/memberry/pull/8). The PR honestly **bundles a large pre-existing
backlog** (recovery-2025 + AHA Steps 31–47, ~628 files) that was NEVER run through CI, snapshotted
in commit `353441a9` as the base, plus this session's verified work on top.

Commits on the branch (newest first):
- `78a2294a` ci: bump Hurl 6.0.0 → 8.0.1 (contract suite uses `toString` filter; 6.0.0 parse-errored)
- `94dd3bb4` fix(test): skip integration tests vs an unmigrated DB (CI unit-tests)
- `0fe71409` test(handlers): 6 co-located tests for backlog handlers (new-code-gate)
- `08f5aae6` fix(test): deterministic email.processor interval test
- `6b8c3e1d` fix(ci): clear inherited CI-gate reds + 3 hard lint errors
- `d5007761` fix(billing): verify platform subscription billing GREEN
- `353441a9` chore(aha): snapshot CONTINUE-48 work + bundled backlog

### Latest CI run on PR #8 — gate status
GREEN: **lint-typecheck, unit-tests (6474 pass / 0 fail), build-api, build-frontends,
new-code-gate, coverage-gate, quality-gates ("gates"), artifact-smoke.**
PENDING last seen: **e2e** (re-check it; may also surface backlog drift).
RED: **contract** — 23/155 flows fail (15%).

## THE TASK — locked decision: "Triage + fix root causes"

The 23 contract failures are **accumulated migration/handler drift in the bundled backlog**, NOT the
subscription-billing work. Boot the stack locally, run the contract suite, root-cause the clusters,
and fix as many of the 23 as are tractable. Likely a HANDFUL of root causes cascade to most of the 23
(esp. the auth/membership/person setup preamble that many flows share).

### The 23 failing contract files
```
audit-side-effects.hurl                      member/credentials/credentials-rbac.hurl
audit.hurl                                   member/directory/directory-rbac.hurl
auth-signup-signin.hurl   ← CASCADE SUSPECT  member/dues-special-assessments/payment-token-validate.hurl
booking-edge.hurl                            member/governance/governance-rbac.hurl
dues-extended-flow.hurl                      member/membership/application-approval-flow.hurl
email.hurl                                   member/membership/application-deny-bulk.hurl
errors.hurl                                  person-lifecycle.hurl
impersonation-flow.hurl                      person-validation.hurl
member/chapters/chapter-affiliation-rbac.hurl persons-extended-flow.hurl
platformadmin-extended-flow.hurl             read-all-flow.hurl
reviews-flow.hurl                            security-officer-auth.hurl
storage-edge.hurl
```

### Root-cause hints harvested from the CI contract log (postgres ERROR lines + app errors)
- `invalid input value for enum dues_invoice_status: "voided"` — enum missing a value a handler uses (migration drift). Affects dues flows.
- `null value in column "joined_at" of relation "membership" violates not-null constraint` — a handler/seed creates a membership without `joined_at` (a backlog migration made it NOT NULL, or handler stopped setting it). Likely breaks application-approval + anything creating memberships → cascades.
- `column "org_id" does not exist` — query references `org_id` where the column is `organization_id` (or a migration didn't add it). Schema/handler drift.
- `value too long for type character varying(20)` — a value exceeds a varchar(20) column.
- `No handler found for job survey.aggregateAnalytics` — a queued job has no registered handler (reviews/surveys flow).
- `UNAUTHORIZED` on auth flows; **`auth-signup-signin.hurl` itself fails** — many contract files run a CSRF→signup→signin preamble; if that preamble's status changed, every dependent flow fails its first `Assert status code`. **Fix this first — it may clear a large fraction of the 23.**

### How to reproduce locally (env is ready)
- Docker UP + healthy: **postgres, minio, mailpit** (containers `hapihub-test-*`). **stripe-mock is DOWN** → Stripe-gateway contract assertions are `[BLOCKED BY ENVIRONMENT]` (don't chase those; `test:contract:full` boots stripe-mock if needed).
- Local pg db `monobase`, migrated through **0071** (next free migration = **0072**). pg at `postgres://postgres:password@localhost:5432/monobase`.
- Local **Hurl 8.0.1** (matches the CI bump). All 97 `.hurl` files parse clean on 8.0.1.
- Boot the API the way CI does, then run contract:
  - `cd services/api-ts && bun dev` (API on **7213**; migrations auto-run on start) — or boot headless like `.github/workflows/ci.yml` "Boot API" step.
  - Seed: `cd services/api-ts && bun run db:seed`.
  - Run suite: `bun run test:contract` (runs `scripts/run-contract-tests.ts` against `$API_URL`, default `http://localhost:7213`). Or run one file: `hurl --variables-file <vars> specs/api/tests/contract/auth-signup-signin.hurl`.
  - CSRF: contract scenarios carry a CSRF preamble; `bun scripts/audit/inject-csrf-into-hurl.ts --check` is a CI gate — don't strip it.
- Suspect the contract **DB state** (migrations vs seed) over the .hurl files: `git diff origin/main -- specs/api/tests/contract/` was EMPTY for the parse-error file, i.e. the .hurl files match main — the drift is in **handlers / migrations / seed** from the backlog. Prefer fixing the schema/handler, not weakening the assertion.

### Ground rules (unchanged)
- TDD where you change handlers; **no fake-green**. Migrations **hand-written**, next `0072`, idempotent + journal + verify on local pg `monobase` (do NOT `db:generate`). Never edit `generated/**` except migrations. Regen only if TypeSpec changed (`specs/api build → api-ts generate → sdk-ts generate`).
- Preserve the dirty tree; **no destructive git** (`reset --hard`, `checkout .`, `clean -fd`, `restore .`). Commit on the branch; the pre-commit hook now passes WITHOUT `--no-verify` (husky has the `NODE_OPTIONS=--max-old-space-size=8192` heap fix). End commits with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Push to the branch (PR #8) to re-run CI — **GitHub Actions billing was fixed this session**, runs work now. Do NOT push to `main`.
- Ignore the pre-existing `email/jobs/index.test.ts` issue (already fixed this session). `check:sdk-compat` exits 1 BY DESIGN (don't `--update` until milestone Step 6).
- Re-verify each fix locally (boot API + re-run the affected `.hurl`) before claiming green. After a batch, push and watch `gh pr checks 8`.

### Definition of done
- contract CI green (or only the documented 3 pre-existing flakies + the stripe-mock `[BLOCKED BY ENVIRONMENT]` set remaining, clearly listed).
- e2e CI green (or its failures triaged the same way — root-cause backlog drift, fix or document).
- All other gates stay green (re-confirm lint-typecheck, unit-tests, new-code-gate, coverage-gate, quality-gates after any handler/migration change).
- Append a dated note to the PR #8 body summarizing what backlog drift was fixed. STOP before merging — recommend, don't merge, without the user.

execute systematically — boot stack, fix `auth-signup-signin` first (cascade), then the enum/`joined_at`/`org_id`/varchar/missing-job clusters; verify before claiming done; do not weaken assertions to fake-green.
