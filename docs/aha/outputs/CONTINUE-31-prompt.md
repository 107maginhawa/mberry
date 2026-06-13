# Continuation prompt — AHA Step 31 (next gated `04`: realtime-comms channel-model batch, PD-1 = auto-join org channels + officer-only creation)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-31-prompt.md`.

> **Decisions already captured — do NOT re-ask.** Documents Q1 was RESOLVED + EXECUTED (Step 30): documents-credentials **Batch A** (verify-chain — FIX-002 route collapse, FIX-012 fail-closed credential secret, FIX-014 staleness) **and Batch A2** (FIX-001 closed — lazy `memberCard` credential producer in `getIdCardData` + UI converged onto `getMyIdCard`) are both DONE and in the dirty tree. The 2 remaining standing P0s are decided + recorded in their `*-fix-ready-plan.md` §"Decisions — Step 29": elections G2 = honor `position` FK (Batch F DONE Step 29), **realtime PD-1 = auto-join org members to org channels + officer-only channel creation** (recorded in `realtime-comms-fix-ready-plan.md` §"Decisions — Step 29"). This step runs the next gated `04`: **realtime-comms channel-model batch**. Fix-only, TDD, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — Batch A channel-create leg (**FIX-003** TypeSpec ChatRoom modeling: `name`/`roomType`/creator auto-add/`context` string-not-UUID; **FIX-002** dialog payload), **FIX-004** default-channels provisioning, **FIX-007** full join-table membership model; §"Decisions — Step 29" (PD-1 resolved = auto-join + officer-only).
3. `docs/aha/module-gap-plans/realtime-comms-gap-plan.md` — G2/G5 evidence (context only).
4. Prior fix-report `docs/aha/module-fix-plans/realtime-comms-fix-report.md` (A real-time delivery + B subset FIX-005/006 + FIX-007 OR-shim + FIX-009 ws:true already done) — **append, don't overwrite**.

## Step 2 — Run realtime-comms channel-model batch (one `04` pass)

Per `04-module-or-group-fix-tdd.md`, execute the **PD-1-unblocked channel-model cluster**: **FIX-003** (comms.tsp channel modeling + regen), **FIX-002** (Create-Channel dialog payload), **FIX-004** (provision `#general`/`#announcements` on org/chapter create — `[CROSS-MODULE RISK]` association:member), and **FIX-007** (replace the OR-check shim with the real `chat_room_member` membership model now that auto-join is decided).

**PD-1 is DECIDED**: org members **auto-join** their org's channels; channel **creation is officer-only** (officer term required). Model the join-table population + officer-only create gate accordingly. Do NOT build explicit-join flows, threading, reactions, read-state, or multi-party video (roadmap §11 "Do Not Build").

TDD discipline:
- RED first (channel-create validator round-trip against the REAL generated validator, not a mocked mutation; WS/REST membership honors `chat_room_member` join-table; officer-only create gate; default-channels provisioning on org create) → confirm each fails for the expected reason.
- Minimal GREEN. Smallest correct change. FIX-003 touches `comms.tsp` → **regen**: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`, then `bun run check:sdk-compat`. Do NOT hand-edit `generated/**`.
- Run validation (focused → module tests → typecheck). Don't claim a command passed unless it ran.
- Append a channel-model section to `realtime-comms-fix-report.md` (the `04` §12 structure).

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 incident + prior AHA passes incl. documents Batch A/A2). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do NOT regress): api-ts `bun test` **6185 pass / 1 pre-existing fail (`registerEmailJobs` interval 30000-vs-1000, unrelated) / 3 todo** (drifted up from 6173 via documents Batch A+A2 = +12 new tests); `tsc` 0 errors (5/5 workspaces); memberry `bun run test` **669 pass / 0 fail**; DB migrated through 0068. Do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6 (note: a FIX-003 TypeSpec change ADDS comms operations/fields — `check:sdk-compat` will report added ops; that is expected, do not baseline-update).
- Step 30 added (don't regress): documents-credentials verify-chain — `apps/memberry/src/routes/verify/$id.tsx` + `verify-dispatch.ts` (collapsed route), `id-card.tsx` QR, `association:member/utils/{credential-token,ensure-member-card-credential}.ts`, `person/utils/id-card-data.ts` `verifyCredentialNumber`.

## Stop condition

After the channel-model batch lands + its fix-report section saved, STOP. Recommend exactly one next gated batch per consolidated-roadmap §8 (candidates: realtime FIX-008 tenant-isolation handler leg + Batch F schema leg, DM PD-2, video PD-3; or surveys PD-1/2/3; or documents Batch C certificates gated on Q8). Do NOT auto-chain to another module.

execute systematically
