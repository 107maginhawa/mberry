# Continuation prompt — AHA Step 28 (Track C: refresh the consolidated remediation roadmap — fold in Steps 26 + 27, then surface the Track B product-decision gate)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-28-prompt.md`.

> **Doc-only, decision-free consolidation pass. NOT a fix, NOT a module, NOT a revert.** AHA Steps 26 (orphan delete cleanup + real-PG approval-transaction rollback guard) and 27 (0068 dup-enroll deploy preflight — idempotent de-dup before the partial unique index) both landed GREEN. Their evidence is in `docs/aha/module-fix-plans/training-credits-fix-report.md` (§"AHA Step 26", §"AHA Step 27"). The existing `docs/aha/outputs/consolidated-remediation-roadmap.md` predates both. This pass re-runs the `07-consolidate-roadmap.md` consolidation to refresh the roadmap so it reflects current Fixed/Partially-Fixed/Blocked state, then states clearly that the only remaining non-deferred work is **Track B product decisions** (which must halt for the user). Manual — no autorun. Touches ONLY `consolidated-remediation-roadmap.md`.

---

Continue the AHA remediation. Run manually. Do NOT use `.claude/workflows/aha-autorun.js`. This is a `07-consolidate-roadmap.md` consolidation/prioritization pass — **read-only over source; it writes ONE doc.**

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Context you must load first

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/07-consolidate-roadmap.md` — follow 07 exactly (its §2 scope rule: do NOT fix anything, do NOT modify/ create source or tests, do NOT rewrite gap/fix-ready/fix-report files).
2. Existing roadmap to refresh: `docs/aha/outputs/consolidated-remediation-roadmap.md` (overwrite per 07 §11 structure).
3. Inputs to re-read for current state:
   - `docs/aha/outputs/module-audit-index.md`
   - all `docs/aha/module-gap-plans/*-gap-plan.md`
   - all `docs/aha/module-fix-plans/*-fix-ready-plan.md`
   - all `docs/aha/module-fix-plans/*-fix-report.md` — **especially** `training-credits-fix-report.md` (now has §"AHA Step 26" + §"AHA Step 27") and `membership-lifecycle-fix-ready-plan.md` §8 (Track B product decisions).
   - if present: `docs/aha/outputs/cross-cutting-pattern-audit.md`, `docs/aha/outputs/database-schema-audit.md`, `docs/aha/kg/*`.

## What changed since the roadmap was last written (must be reflected)

- **AHA Step 26 — DONE/Fixed.** `training-credits` (membership side): two proven-dead orphan delete handlers removed; real-PG `approvalRollback.integration.test.ts` added as the multi-table approval-transaction rollback regression guard. No transaction fix was required (already atomic). Evidence: fix report §"AHA Step 26".
- **AHA Step 27 — DONE/Fixed.** Migration `0068_training_enroll_unique_active.sql` amended in place: idempotent de-dup PREFLIGHT (soft-cancel loser active enrollments by completed>enrolled>noShow, earliest enrolled_at, smallest id) prepended BEFORE the partial unique index, so a boot against dirty data cannot crash the migrator. New real-PG `trainingEnrollDedup.integration.test.ts` proves hazard→preflight→index + idempotency; schema text test extended for ordering. Live local DB was already clean (0 dups) and already had the index applied — the preflight is the forward-looking deploy guard for fresh CI/staging/prod targets. Evidence: fix report §"AHA Step 27".
- These move the training-credits / membership fix coverage forward; classify per 07 §4 + §9 (likely `Partially Fixed` where later batches or Track B remain).

## The work (smallest correct change — exactly the 07 prompt)

- Re-run `07-consolidate-roadmap.md` end to end and OVERWRITE `docs/aha/outputs/consolidated-remediation-roadmap.md` using its §11 required structure (all 19 sections).
- Ensure §5 (Completed Fix Coverage) lists Step 26 + Step 27 as completed with their test evidence; §13 (Product Decisions Needed) lists the Track B membership E2 state-machine items; §18 (Roadmap Decision) and §19 (Immediate Next Step) make the gate explicit.
- `[DO NOT OVERBUILD]`: no new audits, no schema/cross-cutting audit, no fixes, no test changes. Consolidation only.

## Track B is the gate (state it plainly in §13 + §18 + §19)

The only remaining non-deferred work needs product decisions — membership E2 state-machine, per `membership-lifecycle-fix-ready-plan.md` §8:
- reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy.

Label these `[NEEDS PRODUCT DECISION]`. §18 decision should be `BLOCKED BY PRODUCT DECISION`. §19 immediate next step = halt for the user to answer the Track B questions (do NOT auto-decide them).

## ENV / discipline

- Working tree intentionally dirty (~recovery-2025-incident). PRESERVE it. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** Do NOT run aha-autorun. Do NOT commit unless asked.
- Edit ONLY: `docs/aha/outputs/consolidated-remediation-roadmap.md`.
- No code, no tests, no migration touch this pass.

## Stop condition

Save the refreshed `docs/aha/outputs/consolidated-remediation-roadmap.md`. Per 07 §12, recommend exactly one next prompt/action — which here is: **halt for the user on Track B product decisions.** Do NOT start a fix or audit. STOP.

execute systematically
