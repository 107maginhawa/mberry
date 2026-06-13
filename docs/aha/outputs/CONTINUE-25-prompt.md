# Continuation prompt — AHA Step 25 (P0 FIX surfaced by FIX-014: the real officer attendance UI awards no credit — `completeCustomTraining` ignores `personId`)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-25-prompt.md`.

> **This is a small, scoped, decision-free P0 source fix — test-first. NOT a revert, NOT a new module.** The 2026-06-12 FIX-014 real-E2E pass (CONTINUE-22) proved the headline platform value is STILL broken through the real UI: an officer marking a member present awards that member **no credit**. The real attendance UI is the training detail page's **"Attendance" tab → `<CompletionTable>`** (`apps/memberry/src/features/training/components/completion-table.tsx`), whose "Mark Complete" button calls **`completeCustomTraining`** (`services/api-ts/src/handlers/association:operations/completeCustomTraining.ts`). That handler (a) **ignores `body.personId`** and looks up `findMany({ trainingId, personId: user.id })` — the OFFICER's own enrollment, not the targeted member's — and (b) **awards NO credit** (no `awardTrainingCredit` call). Batch A FIX-001 fixed a DIFFERENT, **unreachable** path: `checkInCustomTraining` in `apps/memberry/.../officer/training/$trainingId/attendance.tsx`, which never renders because its parent `$trainingId.tsx` has no `<Outlet/>`. Browser-verified failure: the FIX-014 real-journey E2E is RED at `member must earn a persisted AUTO credit from the real check-in — Received: undefined` (a `400` is logged on the `completeCustomTraining` POST). See `docs/aha/module-fix-plans/training-credits-fix-report.md` §"Batch E subset (FIX-014)" §4 for the full finding. Manual — no autorun.

---

Continue the AHA remediation. Run manually. Do NOT use `.claude/workflows/aha-autorun.js`. This is a `04-module-or-group-fix-tdd.md`-style decision-free P0 fix for module **Training & Credits** (FIX-014-followup: close the real attendance→credit journey).

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Context you must load first

1. `docs/aha/prompts/00-aha-shared-rules.md` (§5 evidence, §11 Playwright, §20 fix/TDD, §23 stop) and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Invoke `superpowers:test-driven-development` and `superpowers:verification-before-completion`.
3. `docs/aha/module-fix-plans/training-credits-fix-report.md` — the **"Batch E subset (FIX-014)" §4 P0 FINDING** (authoritative) + §10 recommended next step.
4. Read fully before editing: `services/api-ts/src/handlers/association:operations/completeCustomTraining.ts`, `services/api-ts/src/handlers/association:operations/checkInCustomTraining.ts` (the correct reference — already honours `personId` + awards via `awardTrainingCredit`), `services/api-ts/src/handlers/association:operations/utils/award-training-credit.ts`, `apps/memberry/src/features/training/components/completion-table.tsx`, and the `CompleteCustomTrainingBody` validator in `services/api-ts/src/generated/openapi/validators.ts`.
5. Recovery tags (DO NOT delete): `recovery-2025-incident` (= current live tree). Re-restore one path only if needed: `git checkout recovery-2025-incident -- <one path>` (NEVER `-- .`).

## The fix (smallest correct change — pick the lower-risk option)

Make the reachable officer "Mark Complete" path actually complete the **targeted member** and award them the AUTO credit, officer-gated. Two candidate approaches — choose after reading both handlers:

- **Option A (preferred if `CompleteCustomTrainingBody` already carries `personId`):** make `completeCustomTraining` honour `body.personId` (target that enrollee's enrollment, not `user.id`), complete it, and award the AUTO credit via the shared `awardTrainingCredit(db, logger, training, targetPersonId)` routine — mirroring `checkInCustomTraining`'s FIX-001 logic. Keep officer authorization (the route's existing position/officer gate). Default to `user.id` only when `personId` is absent (legacy self-complete).
- **Option B (if the contract/validator does NOT cleanly carry `personId`, and adding it = TypeSpec regen = scope creep):** repoint `<CompletionTable>`'s mutation from `completeCustomTrainingMutation` to `checkInCustomTrainingMutation` (already correct: sends `personId`, awards credit, idempotent), matching the `attendance.tsx` call shape. Frontend-only; no backend/regen.

Prefer the option that does NOT require TypeSpec regen. If `personId` is already in `CompleteCustomTrainingBody` (the UI already sends it, cast as `unknown`), Option A is a pure handler change — preferred. `[DO NOT OVERBUILD]`: do not redesign bulk-complete, do not touch the other 4 credit-write paths, FIX-004/005/006, or the dead `attendance.tsx` route except per the OPTIONAL cleanup below.

## TDD discipline (test-first)

1. RED: there is ALREADY a real failing-first artifact — `apps/memberry/tests/e2e/officer/training-completion.spec.ts`, test "officer marking a member present awards THAT member a persisted AUTO credit", quarantined with `test.fail()`. Before fixing, also add/confirm a **backend unit test** that drives the chosen path (e.g. extend `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts` or `check-in.test.ts`): officer completes a NAMED member's enrollment → that member (not the officer) is completed AND an AUTO credit is awarded to them. Run it, confirm RED for the right reason.
2. GREEN: implement the minimal change. Re-run the backend test → pass.
3. **Un-quarantine the E2E:** remove `test.fail()` from the real-journey test. Boot the live stack and run it GREEN (it must now genuinely award the member the credit). It is the real browser proof.
4. Run the training+credits suites (`cd services/api-ts && bun test src/handlers/association:operations/ src/handlers/member/credits/`) + `bun run --filter '*' typecheck` (must stay 5/5). If Option A: also confirm no contract/validator drift; if a regen IS required, STOP and reconsider Option B instead.
5. Do NOT weaken any existing assertion.

## OPTIONAL cleanup (only if cheap + in-scope)

The dead route: `$trainingId.tsx` renders no `<Outlet/>`, so `.../$trainingId/attendance` (→ `attendance.tsx` + its FIX-001 `checkInCustomTraining` wiring) is unreachable. If you chose Option A, `attendance.tsx` is now redundant; if Option B, it is the canonical path. Either way, note the dead-route state in the report; only delete/rewire if it is a 1-line change — otherwise leave + document.

## ENV NOTES (verify at start)

- Docker infra up (postgres/minio/mailpit/stripe-mock). **A LOCAL Homebrew Postgres also binds loopback `:5432` and shadows Docker for `localhost` connections — the API uses the LOCAL pg.** Query the real DB with `PGPASSWORD=password psql -h 127.0.0.1 -p 5432 -U postgres -d monobase` (NOT `docker exec ... psql`, which hits the empty Docker pg). Tables are singular (`training`, `training_enrollment`, `credit_entry`, `person`, `"user"`, `organization`); `person`↔email join via `"user"` (person.id == user.id).
- For the E2E: API auto-boots on 7213 (`bun dev` re-migrates on start) + memberry on 3004 via Playwright `webServer` (`reuseExistingServer`). **Playwright pinned `1.58.2` — DO NOT bump** (1.59 breaks `test.describe`). Seed: member@memberry.ph ("Miguel Bautista") is ENROLLED in the credit-bearing published "Dental Photography Seminar" (credit 8); officer test@memberry.ph also enrolled; org `creditTracking` defaults ON. If a prior run completed the officer's own enrollment, re-seed or pick a fresh enrollee. `apiFetch` helper (`apps/memberry/tests/e2e/helpers/api-fetch.ts`) needs the page on the localhost:3004 origin first (navigate before calling it — about:blank → CORS).

## Tree / commit rules

Working tree intentionally dirty (~recovery-2025-incident). PRESERVE it. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** Do NOT run aha-autorun. Do NOT commit unless asked. This pass edits ONLY: the chosen path (one handler OR `completion-table.tsx`), a backend test, the E2E spec (remove `test.fail()`), and the fix report.

## Stop condition

Append a "FIX-014-followup (P0 award fix)" section to `docs/aha/module-fix-plans/training-credits-fix-report.md` (changes made, approach chosen + why, backend test added, E2E un-quarantined + GREEN evidence, suites + typecheck). Re-run typecheck (5/5) + the credits/operations suite + the now-GREEN E2E. STOP. Do NOT start another batch or module.

## After this pass

- Orphan-handler cleanup (`deleteMembership.ts` / `deleteMembershipApplication.ts`) + FIX-010 real-PG rollback integration test — small, batchable.
- 0068 dup-enroll deploy preflight (de-dupe active duplicate enrollments before applying the partial unique index).
- Then Track B product decisions, then Track C roadmap consolidation (`07-consolidate-roadmap.md` + milestone Step 6).

execute systematically
