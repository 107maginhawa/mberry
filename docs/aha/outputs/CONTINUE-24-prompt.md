# Continuation prompt — AHA Step 24 (FIX-004 COMPLETION: close the 5th cycle-authority write path missed by the Training Batch B autorun pass)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-24-prompt.md`.

> **This is a small, scoped forward `04` fix pass — NOT a revert, NOT a new module.** The 2026-06-12 stabilization pass (CONTINUE-23) verified-and-KEPT all 4 unverified autorun passes and reached typecheck 5/5. It surfaced exactly ONE correctness gap, now re-queued here: **Training Batch B / FIX-004 ("single cycle authority") is incomplete.** `resolveCycle` (`services/api-ts/src/handlers/member/credits/utils/credit-cycle.ts:140-159`) is correct and was wired into FOUR credit-write paths (`award-training-credit.ts`, `awardManualCredit.ts`, `adjustCreditEntry.ts`, `creditIssue.ts`). But a **FIFTH** path was missed: the member self-service route `POST /persons/me/credit-entries` → `handlers/person/createMyCreditEntry.ts` → `CreditService.createEntry` (`handlers/member/credits/services/credit.service.ts:37-38`) still uses the legacy `getCycleForDate(registrationDate, activityDate, cyclePeriodYears ?? 2)` — a hardcoded 2-year window anchored at the activity date, **ignoring `org_cpd_config` entirely**. This is NOT an attacker-controlled self-certification exploit (the body validator `CreateCreditEntryRequestSchema` strips `registrationDate`/`cyclePeriodYears`, so they arrive `undefined`), but it stores a WRONG `cycle_start/cycle_end` on member-self-logged credit rows, and `membership.repo.ts:145` (`cycleStart <= NOW() AND cycleEnd >= NOW()`) trusts those stored columns → real compliance-number drift for the member credit sum. Closing this makes the "one cycle authority" invariant actually true.

---

Continue the AHA remediation. Run manually. Do NOT use `.claude/workflows/aha-autorun.js` (interlocked + unsafe). This is `04-module-or-group-fix-tdd.md` for module **Training & Credits**, batch **Training B / FIX-004 completion**.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Context you must load first

1. `docs/aha/prompts/00-aha-shared-rules.md` (§5 evidence, §20 fix/TDD, §23 stop) and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Invoke `superpowers:test-driven-development` and `superpowers:verification-before-completion`.
3. `docs/aha/module-fix-plans/recovery-stabilization-2026-06-12-report.md` — §4.1 (the FIX-004 gap) and §7 (re-queue row). This is the authoritative description of the gap.
4. `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` (FIX-004 row) + `docs/aha/module-fix-plans/training-credits-fix-report.md` (its FIX-004 section claims "all four write paths / single authority" — that claim is OVERSTATED; correct it when you append your completion section).
5. Recovery tags (DO NOT delete): `recovery-2025-incident` (= current live tree), `recovery-current-tangled`, `recovery-1715-earlier`. Re-restore one path only if needed: `git checkout recovery-2025-incident -- <one specific path>` (NEVER `-- .`).

## The fix (smallest correct change)

Make `CreditService.createEntry` derive the cycle from the org's CPD config via `resolveCycle`, exactly like the other four write paths — instead of `getCycleForDate(..., cyclePeriodYears ?? 2)`.

- Read `handlers/member/credits/services/credit.service.ts` fully. `createEntry(input)` already receives `input.organizationId` (required — see `createMyCreditEntry.ts:42` comment + `:84`). Use it to load `org_cpd_config` and call `resolveCycle(config, input.activityDate)` (match how `awardManualCredit.ts:31-35` / `adjustCreditEntry.ts:36-39` resolve + pass the cycle).
- Confirm where `org_cpd_config` is read in the existing 4 wired paths and reuse that repo/accessor (do NOT invent a new one). If `resolveCycle` needs an anchor date, use `input.activityDate` (the four wired paths' convention) — verify this against `credit-cycle.ts`.
- Drop the now-dead `registrationDate` / `cyclePeriodYears` inputs from `CreateCreditEntryInput` ONLY if they become entirely unused after the change (they are already stripped by the validator, so `createMyCreditEntry.ts:92-93` passes `undefined`); if removing them widens scope or touches other callers, leave them unused and note it — do not chase a refactor. `[DO NOT OVERBUILD]`
- Keep it minimal: this is one service method's cycle computation. Do NOT touch the other 4 paths (already correct), the transcript/compliance reads (FIX-006, correct), or the void filters (FIX-005, correct).

## TDD discipline (test-first)

1. RED: extend `handlers/member/credits/utils/credit-cycle-consistency.test.ts` (or add the nearest existing consistency test) with a case that drives `CreditService.createEntry` (or the `POST /persons/me/credit-entries` handler) and asserts the persisted `cycleStart/cycleEnd` match the **org_cpd_config-driven** window from `resolveCycle` — NOT the legacy 2-year activityDate window. With an org whose config is e.g. 3-year/Jan-anchored, the legacy path yields a 2-year activityDate window → the assertion must FAIL before the fix. Run it, confirm RED for the right reason.
2. GREEN: implement the minimal service change. Re-run → pass.
3. Run the credits suite (`cd services/api-ts && bun test src/handlers/member/credits/`) + `bun test src/handlers/person/createMyCreditEntry.test.ts` (if present) + `bun run --filter '*' typecheck` (must stay 5/5).
4. Do NOT weaken any existing assertion to make it pass.

## Tree / commit rules

Working tree intentionally dirty (~recovery-2025-incident). PRESERVE it. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`, `git stash drop`.** To discard one file's changes: re-edit it or `git checkout recovery-2025-incident -- <one path>`. Do NOT run the aha-autorun workflow. Do NOT commit unless asked.

## Stop condition

Append a FIX-004-completion section to `docs/aha/module-fix-plans/training-credits-fix-report.md` (per the `04` report structure: changes made, test added, tests run, validation) AND correct the overstated "single authority / all four paths" claim in its existing FIX-004 section to reflect the now-five wired paths. Re-run typecheck (5/5) and the credits suite. STOP. Do NOT start another batch or module.

## After this pass

- **CONTINUE-22** (already written): Training Batch E / FIX-014 — real E2E proof of the P0 attendance→credit journey + cross-org RBAC. Needs live stack (API 7213 + memberry 3004, Playwright pinned 1.58.2).
- Orphan-handler cleanup (`deleteMembership.ts` / `deleteMembershipApplication.ts` — unwired, ops removed by FIX-011/decision#6) + FIX-010 real-PG rollback integration test — small, batchable.
- 0068 dup-enroll deploy preflight (de-dupe active duplicate enrollments before applying the partial unique index).
- Then Track B product decisions, then Track C roadmap consolidation (`07-consolidate-roadmap.md` + milestone Step 6).

execute systematically
