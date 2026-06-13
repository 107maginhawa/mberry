# Continuation prompt — AHA Step 27 (0068 dup-enroll deploy preflight: de-dup active duplicate enrollments before the partial unique index)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-27-prompt.md`.

> **Small, scoped, decision-free batchable pass — test-first. NOT a revert, NOT a new module.** AHA Step 26 landed GREEN (orphan delete-handler cleanup + real-PG approval-transaction rollback guard; see `docs/aha/module-fix-plans/training-credits-fix-report.md` §"AHA Step 26"). Next queued: **0068 dup-enroll deploy preflight.** Migration `0068_training_enroll_unique_active.sql` adds a PARTIAL UNIQUE index `uq_training_enroll_active` on `training_enrollment(training_id, person_id) WHERE status <> 'cancelled'`. It has **never been applied to a live DB**. Its own header warns: *"if existing data already contains duplicate active enrollments… CREATE UNIQUE INDEX will fail… such rows must be de-duplicated before the index can be created."* This pass adds an **idempotent de-dup preflight** (runs BEFORE the index in the same migration) so the migrator cannot crash on boot, plus a real-PG test proving the index is creatable after de-dup. Manual — no autorun.

---

Continue the AHA remediation. Run manually. Do NOT use `.claude/workflows/aha-autorun.js`. This is a `04-module-or-group-fix-tdd.md`-style decision-free batchable pass.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Context you must load first

1. `docs/aha/prompts/00-aha-shared-rules.md` (§5 evidence, §11 Playwright, §20 fix/TDD, §23 stop) and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Invoke `superpowers:test-driven-development` and `superpowers:verification-before-completion`.
3. `docs/aha/module-fix-plans/training-credits-fix-report.md` — FIX-010 (Batch D) + §"AHA Step 26". The migration/schema facts:
   - `services/api-ts/src/generated/migrations/0068_training_enroll_unique_active.sql` (hand-authored, idempotent — NOT drizzle-kit generated; editing it is the established exception, it has never run).
   - `services/api-ts/src/handlers/association:operations/repos/training.schema.ts` — `trainingEnrollments` (`training_enrollment`), `enrollmentStatusEnum = ['enrolled','completed','cancelled','noShow']`, the `uniqueIndex('uq_training_enroll_active')`. Cols: `id`, `organization_id`, `training_id`, `person_id`, `status`, `enrolled_at`, `completed_at`, `cancelled_at`.
   - Handler pre-check already exists: `enrollInCustomTraining.ts:43` rejects a second non-cancelled enrollment (`409 ALREADY_ENROLLED`). The index is the race backstop; this pass only makes its first apply safe.

## Scope discovery FIRST (decide the real state before editing)

- `PGPASSWORD=password psql -h 127.0.0.1 -p 5432 -U postgres -d monobase -c "SELECT training_id, person_id, count(*) FROM training_enrollment WHERE status <> 'cancelled' GROUP BY 1,2 HAVING count(*) > 1;"` — count any live duplicate active enrollments. If ZERO, the preflight is a no-op safeguard (document that); still add it + the test as the deploy guard.
- Confirm `uq_training_enroll_active` is NOT yet present: `\d training_enrollment` (or `SELECT indexname FROM pg_indexes WHERE tablename='training_enrollment';`). If it already exists, 0068 already applied cleanly — STOP and document instead of re-running.
- Confirm nothing FKs to `training_enrollment.id` (credits are keyed by person/activity, not enrollment id) so cancelling a loser row destroys no linked record — re-verify with grep before relying on it.

## The de-dup RULE (pinned — keeps this pass decision-free)

Per `(training_id, person_id)`, among NON-cancelled rows, keep exactly ONE **winner**; the losers get `status='cancelled', cancelled_at = now()` (soft-cancel, **never DELETE** — preserves audit + any credit already earned). Winner priority (most-progressed wins, so no completion is ever cancelled):

1. `status = 'completed'` beats `enrolled` beats `noShow`.
2. Tie-break: earliest `enrolled_at` (the original enrollment).
3. Final tie-break: smallest `id` (deterministic).

This rule is conservative + idempotent (re-running cancels nothing new once one winner remains). Do NOT invent a merge that deletes rows or moves credits.

## The work (smallest correct change)

- **Preflight (idempotent), ordered BEFORE the index in `0068...sql`:** prepend an `UPDATE training_enrollment SET status='cancelled', cancelled_at=now() WHERE id IN (<losers>)` that selects losers via the pinned rule (e.g. a window function `row_number() OVER (PARTITION BY training_id, person_id ORDER BY (status='completed') DESC, (status='enrolled') DESC, enrolled_at ASC, id ASC) WHERE status <> 'cancelled'` keeping rn=1). Keep the existing `CREATE UNIQUE INDEX IF NOT EXISTS` after it. Both statements idempotent → safe to re-run. Update the migration header note to record the preflight. `[DO NOT OVERBUILD]`: no schema change, no handler change, no new migration file (0068 has never run — amend it in place; do NOT renumber).
- **No `_journal.json` change** (tag unchanged).

## TDD discipline (test-first)

1. RED: real-PG integration test (follow `resignedAtBackfill.integration.test.ts` / the Step-26 `approvalRollback.integration.test.ts` harness — `pg.Pool` + scratch schema + skip-if-unreachable; do NOT invent a new fixture). Seed a scratch `training_enrollment` with TWO non-cancelled rows for the same `(training_id, person_id)` (e.g. one `completed`, one `enrolled`). Assert that `CREATE UNIQUE INDEX … WHERE status <> 'cancelled'` **FAILS** on that data (RED — proves the hazard). Then run the preflight de-dup SQL and assert: the `completed` row survives non-cancelled, the `enrolled` row is now `cancelled` (with `cancelled_at` set), and the index now creates successfully. Also assert idempotency (re-running preflight cancels nothing further; winner unchanged).
2. GREEN: the amended 0068 (preflight + index) satisfies it. If the live-DB scope query found real dups, also confirm against the real table after a boot/apply (documented).
3. Run the affected suites + `bun run --filter '*' typecheck` (must stay 5/5).
4. Do NOT weaken any existing assertion (the existing `training-enroll-index.schema.test.ts` text/idempotency proof must stay GREEN — if you change 0068's text, update that test's expectations to match the added preflight, without dropping the partial-unique-index assertions).

## ENV NOTES (verify at start)

- Docker infra up. **A LOCAL Homebrew Postgres binds loopback `:5432` and shadows Docker for `localhost` — the API uses the LOCAL pg.** Query: `PGPASSWORD=password psql -h 127.0.0.1 -p 5432 -U postgres -d monobase`. Tables singular (`training_enrollment`, etc.).
- Migrations auto-apply on server start (the migrator). The preflight must therefore live INSIDE 0068, before its `CREATE UNIQUE INDEX`, so a boot with dirty data cannot crash.
- **Playwright pinned `1.58.2` — DO NOT bump** (1.59 breaks `test.describe`).

## Tree / commit rules

Working tree intentionally dirty (~recovery-2025-incident). PRESERVE it. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** Do NOT run aha-autorun. Do NOT commit unless asked. Edit ONLY: `0068_training_enroll_unique_active.sql`, the new real-PG preflight test, the existing `training-enroll-index.schema.test.ts` (only if 0068 text changes), and the fix report.

## Stop condition

Append a section to `docs/aha/module-fix-plans/training-credits-fix-report.md`: live-dup scope-query result + index-not-yet-present evidence, the pinned de-dup rule, RED→GREEN proof (index fails on dup data → preflight cancels losers by priority → index creates), idempotency proof, suites + typecheck (5/5). STOP. Do NOT start another batch or module.

## After this pass

- Track B product decisions (membership E2 state-machine: reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy — see `membership-lifecycle-fix-ready-plan.md` §8). These NEED product decisions → halt for the user.
- Then Track C roadmap consolidation (`07-consolidate-roadmap.md` + milestone Step 6).

execute systematically
