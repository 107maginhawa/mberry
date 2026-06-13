# Continuation prompt — AHA Step 23 (STABILIZATION after the 2026-06-12 autorun git-revert incident: verify-or-revert the 4 unverified autorun passes + return the tree to typecheck-green, BEFORE resuming forward work)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-23-prompt.md`.

> **This is a RECOVERY/STABILIZATION pass, NOT a forward `04` feature pass.** On 2026-06-12 an autonomous autorun orchestrator (`.claude/workflows/aha-autorun.js`) was used to chain decision-free `04` passes as background subagents. A subagent (the `jobs-B` executor) — trying to revert one test file — ran **`git checkout HEAD -- .`** and **`git reset --hard HEAD && git stash drop`** on the SHARED working tree, reverting tracked work mid-run. **Full recovery was achieved**: the dropped stash survived as a dangling commit, tagged **`recovery-2025-incident`** (the complete pre-incident tree, 305 files), and the live tree was restored from it. The orchestrator is now **interlocked** (refuses to run without `{armed:true}`) and **must not be used** until it has per-pass git-worktree isolation. **Going forward: run every pass MANUALLY, one at a time, via these CONTINUE prompts — no unattended autorun.** The lesson: workflow subagents execute in the real tree and CAN run destructive git; prompt prohibitions are not enforcement.
>
> **The problem this pass fixes:** the restored tree (`recovery-2025-incident`) contains, on top of verified work, the autorun's **4 NEVER-VERIFIED passes** — Training **Batch B** (FIX-004 cycle authority, FIX-005 void/pending aggregates, FIX-006 required-credits source), Training **Batch C** (FIX-007 `training.type` + FIX-008 credit-lock, incl. a migration + TypeSpec regen), Training **Batch D** (FIX-009..013), and the **Dues settle-seam** pass (FIX-007 over-refund cap, FIX-010 proof-atomicity, `updateDuesConfig`/`deleteDuesConfig` cross-org guard). These ran amid the git chaos and were **killed mid-flight before any verification** — treat every line of them as an unreviewed PR. The tree also has **3 typecheck errors** that are **PRE-EXISTING HEAD refactor debt, not from this work** (`deleteMembership.ts`/`deleteMembershipApplication.ts` reference `DeleteMembership*Params` that the membership TypeSpec no longer defines; `executeAccountDeletion.ts:112` emits `'person.anonymized'` which `domain-events.registry.ts:22` says was removed). These were masked earlier only because uncommitted prior-AHA work patched them and the rogue `checkout HEAD -- .` reverted that patch for ~3 files.
>
> **VERIFIED + SAFE (do NOT redo, do NOT revert):** Dues **Batch B subset** (FIX-004 ×11 `x-require-position`, FIX-005 `validateFundSplits`, FIX-006 invoice self-scope) — tests 18/18 green, independently adversarially verified pre-incident. Its 3 test files + report section are intact. The `notifications-webhook` pass (5 `organizationId` threads on `handleStripeWebhook` createNotification calls) — verified 38/38 pre-incident. All PRIOR-AHA work (membership, person, billing, marketplace, platformadmin, etc.) predates this session.
>
> **Goal of THIS pass:** land a trustworthy, typecheck-GREEN baseline. For EACH of the 4 unverified autorun passes: adversarially review the actual diff + its fix-report section (Correctness / Scope / Test-Integrity, the same rigor used on dues Batch B) and **KEEP** it only if it is coherent, in-scope, real-RED→GREEN-tested, and its module suite passes — otherwise **REVERT** that pass's files (use `recovery-2025-incident` and the per-module pre-autorun state as the reference) and re-queue it for a clean manual re-run later. Then resolve/triage the 3 pre-existing typecheck errors to reach `bun run --filter '*' typecheck` = 5/5. Stop after saving a stabilization report.

---

Continue the AHA remediation in RECOVERY mode. Do NOT use `.claude/workflows/aha-autorun.js` (interlocked + unsafe). Run everything manually.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Context you must load first

1. `docs/aha/prompts/00-aha-shared-rules.md` (§5 evidence, §20 fix/TDD, §23 stop) and `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD discipline, git-safety §5).
2. Invoke `superpowers:test-driven-development` and `superpowers:verification-before-completion`.
3. Recovery tags (already created — DO NOT delete): `recovery-2025-incident` (the full pre-incident tree = current live state), `recovery-current-tangled`, `recovery-1715-earlier`. To re-restore the baseline if anything goes wrong: `git checkout recovery-2025-incident -- .` (NEVER `git reset --hard` / `checkout .` / `clean` / `restore .`).
4. Fix reports to read (the autorun passes MAY have appended sections — verify they reflect reality, do not trust them): `docs/aha/module-fix-plans/training-credits-fix-report.md`, `docs/aha/module-fix-plans/dues-payments-fix-report.md`.

## Step 1 — Establish the real baseline (evidence first)

- `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/{upsertDuesFunds,listDuesInvoices,dues-position-gate.routes}.test.ts` → expect 18/18 (confirms verified dues Batch B intact).
- `bun run --filter '*' typecheck` → expect 5/5 EXCEPT 3 known api-ts errors (`DeleteMembershipParams`, `DeleteMembershipApplicationParams`, `'person.anonymized'`). Record exact output.
- `cd services/api-ts && bun test` → record pass/fail/todo vs the pre-incident baseline (~6205 pass / 1 fail pre-existing `registerEmailJobs` / 4 todo). NOTE: the unverified autorun passes may have ADDED tests/failures — attribute carefully.

## Step 2 — Triage the 3 pre-existing typecheck errors

These are HEAD-level mid-refactor inconsistencies, NOT this session's fix-work. Decide the minimal correct resolution and reach typecheck 5/5:
- `deleteMembership.ts` / `deleteMembershipApplication.ts` import `DeleteMembership*Params` from `@/generated/openapi/validators`, but the membership TypeSpec no longer defines those delete operations. Determine: was a membership `@operationId("deleteMembership")` op uncommitted-and-reverted (re-add it to the membership `.tsp` + regen), or are these handlers orphaned (then they need the op restored or the handlers reconciled)? Do the minimal correct fix; if it requires reconstructing lost prior-AHA spec work you cannot confidently reproduce, mark `[NEEDS CONFIRMATION]` and document rather than guess.
- `executeAccountDeletion.ts:112` emits `'person.anonymized'` but `domain-events.registry.ts:22` deliberately removed it ("Do not re-add without a real emitter and consumer"). There IS now an emitter (`executeAccountDeletion`). Decide: re-add `'person.anonymized'` to `DomainEventMap` WITH a consumer, OR switch the emit to the existing `'person.deleted'`. Pick the one consistent with the person-deletion cascade design (see `core/domain-event-consumers.ts`); test the chosen path.

## Step 3 — Verify-or-revert each of the 4 unverified autorun passes

Treat each as an unreviewed PR. For EACH pass below: (a) read its actual working-tree diff for the named files; (b) read its fix-report section if present; (c) adversarially check Correctness / Scope / Test-Integrity (real RED→GREEN? in-scope? no fake-green? module suite green?); (d) **KEEP** if solid (note it as verified), else **REVERT that pass's files** to the pre-autorun state and re-queue for a clean manual re-run.

- **Training Batch B** — FIX-004/005/006 in `handlers/member/credits/**` + `association:operations/**` (cycle authority `resolveCycle`, void/pending aggregate filters + `compliance_standings` matview, required-credits collapse to `org_cpd_config` + strip client transcript params). Highest-risk (touches hand-wired `app.ts` transcript routes; changes interpretation of existing rows). Verify cycle-consistency + void-exclusion tests are real; if absent/fake, REVERT.
- **Training Batch C** — FIX-007 `training.type` column (DB migration + TypeSpec regen) + FIX-008 credit-lock in `updateTraining.ts`. A regen ran during the incident — confirm `generated/**` matches the current `.tsp` (re-run `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` and diff). If the migration is malformed or the regen is inconsistent, REVERT this pass.
- **Training Batch D** — FIX-009..013 (toggle enforcement, dup-enroll index, `/my/training` predicate, CSV export, createTraining org-strip).
- **Dues settle-seam** — FIX-007 over-refund cap + eligibility, FIX-010 `confirmPaymentProof` transaction atomicity, `updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard in `handlers/member/duesspecialassessments/**`. `[CROSS-MODULE RISK]` — settle delegates into `membership-lifecycle.ts`; require membership-status side-effect assertions, else REVERT.

Bias: **when in doubt, REVERT and re-run clean later.** A reverted pass is re-runnable from its fix-ready plan; a silently-broken kept pass is a landmine. Do NOT keep a pass on the strength of its self-reported fix-report alone — confirm against the diff + a green run.

## Step 4 — Land + report

- Re-run: dues Batch B tests (18/18), the training+credits module suite, the dues module suite, full `bun test`, and `bun run --filter '*' typecheck` (must be 5/5).
- Write `docs/aha/module-fix-plans/recovery-stabilization-2026-06-12-report.md` recording: the incident + recovery (tags), per-pass KEEP/REVERT decisions with evidence, the 3 typecheck-error resolutions, final baselines, and the re-queued passes. STOP.

## After this pass (the manual forward sequence — one session each, via /clear + CONTINUE)

- **CONTINUE-22** (already written): Training **Batch E** / FIX-014 — real E2E proof of the P0 attendance→credit journey + cross-org RBAC. Needs live stack (API 7213 + memberry 3004, Playwright pinned 1.58.2).
- Any **REVERTED** autorun passes from Step 3 → re-run cleanly here, manually, one per session (Training B, then C, then D; Dues settle-seam) using `docs/aha/module-fix-plans/{training-credits,dues-payments}-fix-ready-plan.md`.
- Then carry-forward loose ends (realtime DM-UI, jobs Batch B, auth officerAuthMiddleware triplet) and Track B product decisions, then Track C (re-run `07-consolidate-roadmap.md` + milestone Step 6: `--update` frozen `check:sdk-compat`, commit/PR).

## Tree / commit rules

- Working tree intentionally dirty (~recovery-2025-incident, 300+ files). PRESERVE it. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git clean -fd`, `git restore .`, `rm -rf`, and `git checkout HEAD -- .`** (the last is exactly what caused the incident — to discard a single file's changes, re-edit the file or use `git checkout recovery-2025-incident -- <one specific path>`, never `-- .`). Do NOT run the `aha-autorun` workflow. Do NOT commit unless asked.

## Ground rules

Follow `00-aha-shared-rules.md` + `04-module-or-group-fix-tdd.md`. This is a stabilization pass: verify-or-revert the 4 unverified autorun passes, fix the 3 typecheck errors, reach a green verified baseline, save the stabilization report, STOP. Do NOT start training-E or any new forward `04` pass in this session. Run everything manually — no unattended orchestration.

execute systematically
