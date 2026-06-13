# Continuation prompt — AHA Step 26 (orphan-handler cleanup + FIX-010 real-PG rollback integration test)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-26-prompt.md`.

> **Small, scoped, decision-free batchable pass — test-first. NOT a revert, NOT a new module.** The FIX-014-followup P0 award fix landed and is GREEN (officer "Mark Complete" now awards the targeted member their AUTO credit via `checkInCustomTraining`; see `docs/aha/module-fix-plans/training-credits-fix-report.md` §"FIX-014-followup"). Next queued AHA item: **(a) orphan-handler cleanup** — `deleteMembership.ts` / `deleteMembershipApplication.ts` are unreferenced/dead-wired; confirm via grep before touching. **(b) FIX-010 real-PG rollback integration test** — prove the membership-delete (or whichever multi-table delete FIX-010 named) actually rolls back atomically against real Postgres, not a mock. Manual — no autorun.

---

Continue the AHA remediation. Run manually. Do NOT use `.claude/workflows/aha-autorun.js`. This is a `04-module-or-group-fix-tdd.md`-style decision-free batchable pass.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Context you must load first

1. `docs/aha/prompts/00-aha-shared-rules.md` (§5 evidence, §11 Playwright, §20 fix/TDD, §23 stop) and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Invoke `superpowers:test-driven-development` and `superpowers:verification-before-completion`.
3. `docs/aha/module-fix-plans/training-credits-fix-report.md` — the **FIX-010** finding (rollback atomicity) and the **§10 Recommended Next Step** list.
4. **Scope discovery FIRST (decide what's actually dead before editing):**
   - `grep -rn "deleteMembership\b\|deleteMembershipApplication\b" services/api-ts/src --include='*.ts'` — find references (routes registry, app.ts, generated registry, tests, re-exports). A handler is only "orphan" if nothing routes to it AND nothing imports it. If a generated route references it, it is NOT orphan — STOP and document instead of deleting.
   - Read the two handlers + their repo delete methods + any FIX-010-relevant transaction wrapper.
5. Recovery tags (DO NOT delete): `recovery-2025-incident` (= current live tree). Re-restore one path only if needed: `git checkout recovery-2025-incident -- <one path>` (NEVER `-- .`).

## The work (smallest correct change)

- **Orphan cleanup:** only if grep PROVES a handler is unreferenced (no generated route, no app.ts wiring, no import, no re-export). If proven dead, delete the file (and its test if test-only-for-the-dead-handler). If ANY reference exists, leave it and document why. `[DO NOT OVERBUILD]`: do not refactor live membership delete paths.
- **FIX-010 rollback test:** add a real-Postgres integration test (not a mock) that drives the multi-table delete FIX-010 names and asserts that an induced failure mid-transaction leaves ZERO partial rows (full rollback). Use the existing real-PG test harness pattern in the repo; do NOT invent a new DB fixture if one exists.

## TDD discipline (test-first)

1. RED: write the rollback integration test first; induce the failure; confirm it FAILS for the right reason if the code does NOT roll back (or confirm GREEN documents existing-correct behavior — if already correct, the test is a regression guard, state that explicitly).
2. GREEN: implement the minimal transaction fix if RED. Re-run → pass.
3. Run the affected suites + `bun run --filter '*' typecheck` (must stay 5/5).
4. Do NOT weaken any existing assertion.

## ENV NOTES (verify at start)

- Docker infra up (postgres/minio/mailpit/stripe-mock). **A LOCAL Homebrew Postgres binds loopback `:5432` and shadows Docker for `localhost` connections — the API uses the LOCAL pg.** Query the real DB with `PGPASSWORD=password psql -h 127.0.0.1 -p 5432 -U postgres -d monobase`. Tables singular (`membership`, `membership_application`, `person`, `"user"`, `organization`); `person_id` is uuid, `"user".id` is text — join with `u.id = te.person_id::text`.
- **Playwright pinned `1.58.2` — DO NOT bump** (1.59 breaks `test.describe`).

## Tree / commit rules

Working tree intentionally dirty (~recovery-2025-incident). PRESERVE it. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** Do NOT run aha-autorun. Do NOT commit unless asked. Edit ONLY: the proven-dead handler(s), the new rollback integration test, any minimal transaction fix it forces, and the fix report.

## Stop condition

Append a section to `docs/aha/module-fix-plans/training-credits-fix-report.md` (or the membership fix report if more apt): orphan-grep evidence + decision per handler, rollback test added (RED→GREEN or regression-guard), suites + typecheck (5/5). STOP. Do NOT start another batch or module.

## After this pass

- 0068 dup-enroll deploy preflight (de-dupe active duplicate enrollments before applying the partial unique index).
- Then Track B product decisions, then Track C roadmap consolidation (`07-consolidate-roadmap.md` + milestone Step 6).

execute systematically
