# Continuation prompt — CONTINUE-56 (EXECUTE the durable e2e green-gate fix; GO approved)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-56-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-55 done — root cause SETTLED)

CONTINUE-55 root-caused the e2e failures with **real direct-HTTP evidence**. Full writeup:
`docs/aha/outputs/CONTINUE-55-e2e-plan.md`. Summary:

- The mid-run officer/society failures are **401 (session revoked), NOT 403.**
- Cause = **V-15 concurrent-session-limit** (`services/api-ts/src/core/session-limit.ts`,
  `DEFAULT_SESSION_LIMIT = 5`, wired unconditionally at `core/auth.ts:299-300` via
  `config.auth.sessionLimit ?? 5`). On each new sign-in past 5, the API **hard-deletes the
  oldest session row**.
- The e2e harness signs each persona in **once** (`apps/memberry/tests/e2e/auth.setup.ts` →
  `.auth/<role>.json`) and reuses that **one long-lived `storageState`** (the oldest session)
  for the whole 46-min run. 30+ specs re-sign-in the same seeded personas
  (`test@memberry.ph` etc.) → once 5 newer sessions accumulate, V-15 deletes the storageState
  session → every later spec is unauthenticated → **401 → `toBeVisible` cascade.**
- Proven deterministically (pure curl, no specs): signin #2..#5 keep oldest cookie 200;
  **signin #6 → oldest cookie 401** (sessions capped at 5, oldest hard-deleted).
- The "259/721 fresh-DB failures" is **inflated by this one cascade** — not 259 independent
  bugs. Product (V-15) is correct; the harness assumption (one immortal session) is wrong.
- Ruled out: 403/officer-term (terms stayed 2-active throughout), 2FA (isDev-skipped), 24h
  session expiry, account-lockout ban (inert in dev), dirty seed data.

**GO approved by user (2026-06-14). Build the DURABLE fix, not just the band-aid.**

## THE TASK — make e2e green + fast + DURABLE (set-and-forget)

Critical design note: **`SESSION_LIMIT` override alone is NOT durable.** Role/term/membership
mutations *also* revoke sessions by design (`handlers/member/governance/updateOfficerTerm.ts`,
`deleteOfficerTerm.ts`, `member/membership/{resign,terminate,decease}Membership.ts`, P1-4
role-change at `core/auth.ts:219`). The day a spec mutates the seeded officer's role/term, the
401 cascade returns even with a high limit. **Durability requires per-spec fresh auth** so no
spec depends on a stale session and no mutation can 401 the next spec.

Execute in this order. STOP at the marked checkpoints.

### Phase 0 — `SESSION_LIMIT` test-env override (immediate root-cause fix)
- Set `SESSION_LIMIT=100000` in the API process the e2e suite runs against:
  - `.github/workflows/ci.yml` → the `e2e` job `env:` block (where the API is booted).
  - the local e2e API boot (`apps/memberry/playwright.config.ts` webServer `command`, or a
    test `.env` the launched `bun dev` reads). Production stays at 5 (do NOT change the default).
- Verify with the CONTINUE-55 isolation repro: sign in as `test@memberry.ph` 6× via curl;
  with the override the oldest cookie must still return **200** after the 6th.
- Commit.

### Phase 1 — Durable per-spec auth (immune to legitimate session revocation)
- Replace single long-lived `storageState` reuse with **per-spec-file fresh auth** via a fast
  **programmatic (API) sign-in fixture** — `POST /auth/sign-in/email` (verified working),
  capture cookies into a per-file/per-worker context. No UI sign-in, no 40-min-old session.
- Goal: a role/term/membership mutation in spec N **cannot** 401 spec N+1; V-15 eviction
  can't kill an in-use session. Keep Phase-0 limit high as belt-and-suspenders.
- Verify: run `officer/` + the governance cluster (`elections`, `election-integrity`,
  `detail-pages`, `role-assignment`) serially → **zero 401 cascade** (in CONTINUE-55 this
  cluster killed the old storageState).
- Commit.

### Phase 2 — Re-measure the TRUE backlog (DECISION CHECKPOINT — STOP)
- Run the **full memberry suite on a fresh DB**, capture the **new** failure count +
  per-spec list (cascade now removed). LESSON: quiet machine, no heavy bash during the run
  (CONTINUE-51 caused 257 false `toBeVisible` timeouts under concurrent load).
- Report the real number + a UI-drift / data-presence / genuine-bug split.
- **STOP. Present to user before sizing Phases 3-4.**

### Phase 3 — Triage + fix the residual real backlog
- UI-selector drift (mechanical): known offenders `officer/communications.spec.ts:55/72/135`,
  `journeys/communication-delivery.spec.ts` seeded-title assertions.
- Genuine bugs incl. the **early-run 403** (President persona hitting endpoints gated to
  another position — small, separate pre-existing authz mismatch; confirm intended access).
- TDD on any handler touched. Re-verify each batch on a fresh DB.

### Phase 4 — Per-test seed isolation (G10) — durable DATA (conditional on Phase 2)
- Only if Phase 2 shows residual **data-presence** failures: add a test-only
  `/test/seed-isolated` endpoint provisioning a throwaway org + officer per test, so specs
  stop asserting against the shared mutable seeded org. Prod-guarded (disabled outside test).
  Hand-written migration **next = 0073** if schema is touched (idempotent + journal; NO
  `db:generate`). Then `workers` can safely exceed 2.

### Phase 5 — Shard < 30 min + decouple coverage-gate (durable CI)
- **Decouple `coverage-gate`** (`.github/workflows/ci.yml` L407): change `needs:[lint-typecheck,e2e]`
  → `needs:[lint-typecheck]` (its BR-coverage + CSRF-drift checks don't depend on e2e; today
  they're silently skipped whenever e2e times out).
- **Shard:** `e2e-memberry` matrix `shard:[1..6]` (`bunx playwright test --shard=N/6`, each its
  own postgres+minio+API+app, `fail-fast:false`, workers=2/shard) + `e2e-admin` (workers=1) +
  an aggregator job **named `e2e`** (`if:always()`, `needs:[e2e-memberry-*, e2e-admin]`, fails
  unless all pass). **Do NOT rename `e2e`** — `ci-gate` (L516, checks `needs.e2e.result` ~L545)
  + `coverage-gate` depend on that name. Tradeoff (accepted): ~6-7× CI minutes/run.

### Phase 6 — Verify + handoff
- Watch `gh pr checks 8` until `e2e` (aggregator) + `coverage-gate` are green and the suite
  completes < 30 min. Append a dated note to PR #8. **STOP before merge unless user says merge.**

## Ground rules (CONTINUE-52, unchanged)
- Branch off the current branch (`aha/continue-49-subscription-billing`, PR #8) — **do NOT
  push to `main`**. TDD where you change handlers; **no fake-green**.
- Migrations hand-written, next **0073**, idempotent + journal (do NOT `db:generate`). Never
  edit `generated/**` except migrations.
- Preserve the dirty tree; no destructive git. Pre-commit hook passes **without** `--no-verify`.
  End commits with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `check:sdk-compat` exits 1 BY DESIGN. `db:generate` exits 127 in Quality Gates (benign).
- Re-verify each fix on a FRESH DB before claiming green. **No heavy bash (psql/grep/builds)
  DURING an e2e timing run** — concurrent load causes false `toBeVisible` timeouts. Quiet machine.

## Out of scope (note, don't do)
- **`Deploy` ghcr.io push perms** — GitHub org→Packages settings toggle (Actions `packages:write`
  / allow org-package create). One-time settings, not code. Parallel non-code TODO.
- **2 P0 product decisions (USER, not engineering):** G2 elections position-identity model
  (FK vs jsonb); Q1 documents card-verify token format. Independent of e2e; list as blockers.

## Definition of done
- e2e CI **green** (full memberry + admin < 30 min on a fresh DB), **durable**: per-spec fresh
  auth + SESSION_LIMIT override so it stays green through future role/term/session mutations.
- `coverage-gate` no longer skipped by e2e. All other gates green. Dated note on PR #8.
  STOP before merge.

## Repro quick-ref (from CONTINUE-55, local)
- Probe: `GET /accredited-providers/ed8e3a96-8126-4341-be42-e6eb7940c562` (President-gated).
- Officer: `test@memberry.ph` / `TestPass123!`. Sign-in: `POST /auth/sign-in/email`.
- V-15: `SESSION_LIMIT` env (`config.ts:156→347`), default 5, NOT set in CI/e2e.
- Stack may still be running from CONTINUE-55: API 7213, app 3004, DB `monobase`.
