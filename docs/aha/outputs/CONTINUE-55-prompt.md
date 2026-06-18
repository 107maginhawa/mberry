# Continuation prompt — CONTINUE-55 (PLAN the e2e green-gate work; do NOT execute yet)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-55-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-54 done)

- CONTINUE-53 merged to `main` via PR #9 (squash `a6ba57d2`); main HEAD now `7553767d`.
- CONTINUE-54 (2026-06-14): repo `eladventures/memberry` made **PUBLIC** → GitHub Actions
  unblocked (was billing-blocked). Re-ran CI on `a6ba57d2`. **All required code gates GREEN**
  (lint-typecheck, unit-tests, contract, build-api, build-frontends, artifact-smoke; Quality
  Gates ✓; standalone Contract Tests ✓). Only red = `e2e` **cancelled at 30-min job timeout**
  mid-Memberry-suite → cascades `coverage-gate` skipped + `ci-gate` failure. `Deploy` red =
  ghcr.io push perms (org-package toggle, infra not code). No code regression.

## THIS TASK IS PLAN-ONLY

Produce a written plan for making `e2e` a real, fast, green CI gate. **Do NOT write fixes,
do NOT touch the suite, do NOT push.** Output = a plan doc + a recommendation. The scope
source is `docs/aha/outputs/CONTINUE-52-prompt.md` (read it first — it has the full task
breakdown and known offenders). This prompt adds a mandatory root-cause gate before any
execution is greenlit.

### Step 0 — Read context
- `docs/aha/outputs/CONTINUE-52-prompt.md` (the execute spec: 3 sub-problems + ground rules)
- `apps/memberry/playwright.config.ts` (the `workers:2` / G10 comment)
- `tests/e2e/global-setup.ts` (what it resets — only 2 org rows + association baseline)
- `docs/audits/E2E_REMEDIATION_FINAL.md` (§Parallel contamination, if present)
- `.github/workflows/ci.yml` — the `e2e` (L~?), `coverage-gate` (L407, `needs:[lint-typecheck,e2e]`),
  `ci-gate` (L516) jobs. Confirm the `needs` wiring before proposing any change.

### Step 1 — ROOT-CAUSE GATE (the decision that sizes everything)
CONTINUE-52 claims a **fresh clean DB fails 259/721**, and officer/ run **serially** still
fails **73/151**, with officer API calls returning **403 deep into a long run** while every
feature passes in isolation. Its hypothesis: **session/auth + shared-seed-state degrade with
run length** (one long-lived storageState, global-setup resets once).

**Settle which it is BEFORE planning fixes — this is a fork, not a footnote:**
- **A) Real product auth/session bug** (sessions/tokens rot under sustained load / long-lived
  use) → higher stakes, affects real users, fix is in the app not the test harness.
- **B) Test-infra only** (single reused storageState + shared mutable seed state) → contained
  to the e2e harness; fix is per-spec auth refresh + per-test seed isolation (G10).

How to settle it cheaply, WITHOUT running the full 46-min suite (and on a quiet machine —
LESSON: heavy concurrent load caused ~257 false `toBeVisible` timeouts in CONTINUE-51):
- Reproduce ONE 403: run a single officer spec in isolation (passes), then run it as the
  Nth spec after padding the run, and capture the actual failing HTTP response (status +
  body) via direct request capture, not just a UI `toBeVisible` timeout.
- Check whether the 403 correlates with **auth** (expired/invalidated session, storageState
  staleness) vs **data** (seed row deleted/mutated by an earlier spec) vs **server** (API
  process degrading — memory, connection pool exhaustion deep into the run).
- Inspect `global-setup.ts` + how storageState is captured/reused, and whether the API
  server is rebooted between shards or runs hot for 46 min.
Output a one-paragraph verdict: **A or B (or mixed), with the captured-HTTP evidence.**
(Root-cause-layers rule: verify via direct HTTP capture, not UI traces alone.)

### Step 2 — Produce the plan (sized to the Step-1 verdict)
Write `docs/aha/outputs/CONTINUE-55-e2e-plan.md` with:
1. Step-1 verdict + evidence.
2. If verdict = A (real bug): a TDD fix plan for the auth/session defect FIRST (this is a
   product bug, not test cleanup), then the harness work. If B: skip to harness work.
3. The 3 CONTINUE-52 sub-problems, each broken into concrete tasks with effort estimates:
   - (1) per-spec auth refresh + per-test seed isolation (G10 `/test/seed-isolated`).
   - (2) triage the pre-existing failure backlog — list the known offender specs, estimate
     how many of the 259 are UI-selector drift vs data-presence vs real bugs (sample a few
     in isolation to calibrate; don't fix yet).
   - (3) shard matrix (`e2e-memberry` shard 1..6 + `e2e-admin`, aggregator job still
     **named `e2e`** so `ci-gate`/`coverage-gate` keep working) + decouple `coverage-gate`
     from `e2e` (drop `e2e` from its `needs`).
4. Sequencing + a total effort estimate (be honest — this is multi-session).
5. An explicit GO / NO-GO recommendation: is this worth doing now vs deferring? Weigh against
   the open AHA P0 product decisions (G2 elections, Q1 documents) that need the USER, and the
   fact that e2e is non-required + PRs already merged (not release-blocking).

### Step 3 — Surface for approval
Present the plan + GO/NO-GO. STOP. Do not start execution without the user's go-ahead.
If GO, the execution follows `CONTINUE-52-prompt.md` ground rules (branch off `main`, TDD on
handlers, hand-written migration next **0073**, no `db:generate`, no edit of `generated/**`
except migrations, pre-commit passes without `--no-verify`, no push to `main`).

## Out of scope for this prompt (note, don't do)
- `Deploy` ghcr.io push perms — separate GitHub org→Packages settings toggle (grant Actions
  `packages: write` / allow org-package create). One-time, not code. Mention in the plan as a
  parallel non-code TODO; don't try to fix it here.
- The 2 P0 product decisions (G2 elections position-identity model, Q1 documents card-verify
  token format) — these need a USER decision, not engineering. List as blockers, don't touch.

## Definition of done (for THIS plan-only task)
- Step-1 root-cause verdict captured with real HTTP evidence (A vs B vs mixed).
- `docs/aha/outputs/CONTINUE-55-e2e-plan.md` written with tasks, estimates, sequencing,
  GO/NO-GO. No code touched, nothing pushed. Recommendation presented to the user.
