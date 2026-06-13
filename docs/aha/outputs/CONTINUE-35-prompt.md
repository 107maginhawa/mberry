# Continuation prompt — AHA Step 35 (elections Batch F / G2 — FIX-002 position-identity P0; decision: honor the FK, reference real governance `position` rows)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-35-prompt.md`.

> **Decision already captured — do NOT re-ask.** The position-identity fork (FIX-002 / G2) is resolved to the fix-ready plan's own recommendation (`elections-governance-fix-ready-plan.md` line 112): **honor the FK — election nominee/vote rows reference real governance `position(id)` rows.** DROP the module-local random-UUID/string jsonb "slots" as the identity source. This is an **engineering-default decision** taken under the user's defer-to-Claude standing instruction; it is **pending user ratification** (Track-B pattern, same as membership E2/F) — implement it, flag it ratification-pending in the fix-report, do NOT treat as final-final. **Rationale:** governance `position` is already the live source of truth (officer-checks, dues, invite, association:operations all read it); seeds `layer-5-gap-fill.ts` already insert real position ids; the FKs (`election_nominee_position_id_position_id_fk`, migrations 0028/0031) already exist — so honoring them is *aligning to reality*, while dropping them would orphan the cross-module consumers. **OUT of scope / still gated, do NOT touch:** FIX-004 cancel-cascade + **cancelled-election vote-retention** (soft-void vs hard-delete — separate `[NEEDS PRODUCT DECISION]`, Batch B), FIX-003/005 remainder, Batch C (FIX-008/009/010/011), all §10 Deferred + §11 Do-Not-Build (bylaw Yes/No/Abstain, hybrid voting, BR-34 tenure config, voter-hash rearchitecture, auto-close job, enum G10, deleting legacy `handlers/elections/*`). Prior elections work still holds: FIX-001 close-voting (Batch A) + FIX-003 ballot-secrecy + FIX-005 immutability (Batch B) DONE. Fix-only, TDD, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` — **FIX-002** (§ rows 40, 68, 85, 100–105), **Batch F** (§7 batch table, schema/migration/seed isolation), §11 (Test-First: FIX-007 + FIX-002), §13 decision table (line 112 recommendation = the captured decision), §22 blast-radius constraints.
3. `docs/aha/module-gap-plans/elections-governance-gap-plan.md` — G2 raw evidence only (context).
4. Prior fix-report `docs/aha/module-fix-plans/elections-governance-fix-report.md` — **append, don't overwrite**.

Invoke `/using-superpowers` → `superpowers:test-driven-development` before coding (mandatory per 04 §3).

## Step 2 — Execute FIX-002 (G2 position identity) under the captured decision

**Identity model (decided):** election nomination + vote rows carry a real governance `position(id)` FK. Election "positions" are no longer random jsonb slot UUIDs minted in `createElection.ts`; they map to governance `position` rows for that org/term.

**RED first (highest-value test, write before any source change):**
- `services/api-ts/src/handlers/member/governance/election-lifecycle.integration.test.ts` (NEW, real-DB harness per VERTICAL_TDD) — full path: createElection → createCandidate (nominate against a real `position`) → openElectionVoting → castBallot → closeElectionVoting → certifyElection, **no repo mocks**. Confirm it FAILS today at the FK-violation / min-candidate-guard point (this also empirically resolves the `[NEEDS CONFIRMATION]` runtime-5xx severity question — record the actual error).
- Then extend / fix `member/governance/openElectionVoting.test.ts` to use **realistic position ids** (replace the self-consistent fake ids that currently mask G2).

**GREEN (smallest correct change, honor-the-FK shape):**
- `member/governance/createElection.ts` (~36–40): stop minting random jsonb slot UUIDs as identity; bind election positions to real `position(id)` refs.
- `member/governance/openElectionVoting.ts`: count/group by the real position id (min-candidate guard must pass).
- `member/governance/updateElection.ts`: do NOT regenerate position ids (already immutability-guarded by FIX-005 — keep it; just ensure no UUID re-mint path remains).
- Schema/seed alignment **(Batch F — isolated, high blast radius)**: `handlers/elections/repos/elections.schema.ts` + NEW migration (`bun run db:generate`, review SQL); seeds `layer-3-modules.ts:84` (string[] wrong shape → real position refs) + `layer-5-gap-fill.ts:154-157` (already real ids — make the slots match). **Additive/aligning only.** Verify the ripple to `preload-pristine` + `schema-registry` consumers.
- Frontend dialogs: `nominee-picker-dialog.tsx`, `self-nomination-dialog.tsx`, `member-election-detail.tsx` — send the real `positionId`, not a slot id.

**Hard constraints (R2 / cross-module — verify, don't break):**
- Do NOT change the `election.published` event name or payload shape (M04 org-admin RBAC consumer contract). Do NOT add `election.cancelled` (that's FIX-004, gated).
- New ops, if any, go through TypeSpec → `cd specs/api && bun run build` → `cd services/api-ts && bun run generate`. Do NOT hand-edit generated files. (FIX-002 likely needs NO new op — it's schema/handler/seed/FE alignment; confirm.)
- `elections.schema.ts` is consumed by seeds / preload-pristine / schema-registry / core-auth officer-checks / dues / invite / association:operations — keep changes additive; keep the repo location.
- Migrations run automatically on server start; DB is migrated through 0068 — this pass adds the next migration.

If honoring the FK cleanly is NOT separable from a larger governance-position refactor, ship the isolable subset (schema+seed alignment + the integration test proving the FK now holds) and mark the rest a remaining gap — do NOT broaden into a governance rebuild.

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 + AHA Steps 31–34 incl. comms FE org-scoping). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do NOT regress): api-ts `bun test` **6217 pass / 2 fail** (both PRE-EXISTING + UNRELATED: `registerEmailJobs` interval flake; `getNextBookableTime` wall-clock flake). memberry `bun run test` **679 pass / 0 fail** (Step 34). `tsc` **5/5** clean. DB through **0068** (this pass adds one migration). `check:sdk-compat` exits 1 from pre-existing advertising/jobs/marketplace path-move drift (zero elections ops) — do NOT `--update` baseline.
- Validation to run (don't claim a command passed unless it ran): the new integration test (RED→GREEN) → `bun test src/handlers/member/governance/` → focused seed/preload sanity → full api-ts `bun test` → monorepo `bun run typecheck` → memberry `bun run test`. If you regen TypeSpec, run the full generate pipeline.
- Append a FIX-002 / Batch F section to `elections-governance-fix-report.md` (04 §12 structure), explicitly marking the position-identity decision **ratification-pending**.

## Stop condition

After FIX-002 / Batch F lands + its fix-report section saved, STOP. Recommend exactly one next gated batch (candidates: elections **FIX-004** cancel-cascade + vote-retention decision; or documents **Q1** card-verify token contract P0; or realtime **DM PD-2**). Do NOT auto-chain.

execute systematically
