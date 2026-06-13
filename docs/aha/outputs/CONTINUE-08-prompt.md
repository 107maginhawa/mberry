# Continuation prompt — AHA Step 08 (next `04`: elections-governance Batch B)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-08-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, ONE batch). It modifies source + tests. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch other modules, do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **elections-governance, Batch B (decision-free subset)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (15 *-gap-plan.md)
03-organize-gap-plan-for-fixing.md     # DONE (15 *-fix-ready-plan.md)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED batch; stop after the fix report.

## What just completed (do NOT redo)

- **`07` roadmap refresh (2026-06-12)** — `docs/aha/outputs/consolidated-remediation-roadmap.md` rebuilt. 15/15 modules `Partially Fixed`. ~105 gated decisions ranked (3 P0: elections G2, documents Q1, realtime PD-1). The §8 "Recommended Fix Sequence" (Track A = decision-free, A1–A13) is the order to follow.
- **`04` Membership Lifecycle Batch C (2026-06-12)** — COMPLETE. FIX-005/006/012/014/015/016/017/018/020 landed RED→GREEN. (FIX-016 Partially Fixed: cap+per-row-validation done; email-match-link deferred — needs a TypeSpec import-row `email` field + product call.) See `docs/aha/module-fix-plans/membership-lifecycle-fix-report.md` § "Batch C — P2/P3 workflow completeness (2026-06-12)". Membership's entire decision-free (Track-A) scope is now done.

## This pass — execute `04` for elections-governance Batch B

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md`
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/elections-governance-gap-plan.md`
   - Prior fix report (what's already done): `docs/aha/module-fix-plans/elections-governance-fix-report.md` (Batch A = FIX-001 close-voting + FIX-007 RED test, COMPLETE).
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected batch — Batch B, DECISION-FREE subset only:**
   - **FIX-003 / G-3** — ballot secrecy: `listBallots` returns raw `voterId→nomineeId` rows to admins (secret-ballot violation WF-077) + members are 403'd from their own "my ballots". Fix: server-side secrecy (admins get aggregate/no voter↔nominee linkage), add member self-read of own ballots. **Decision-free.**
   - **FIX-005 / G-5** — `updateElection` immutability/state guard: currently allows PATCH of title/dates/positions on PUBLISHED elections and regenerates position ids (M12-R2 result-finality violation). Fix: state-machine guard blocking mutation of published/finalized elections. **Decision-free.**
5. **Do NOT** implement in this pass (gated / out of batch):
   - **FIX-002 / G2 position-identity (P0)** — `[NEEDS PRODUCT DECISION]` (FK vs jsonb slots). Separate gated Batch F. **Excluded.**
   - **FIX-004 / G-4** — live `cancelElection` + cascade — its **cancelled-election vote-retention** sub-question is `[NEEDS PRODUCT DECISION]` (P2). If FIX-004's cascade can be built without deciding retention, scope only the safe part; otherwise mark blocked and defer. Prefer FIX-003 + FIX-005 this pass; treat FIX-004 as gated unless trivially safe.
   - Batch C (FIX-008/009/010/011), tie-handling, WF-078 bylaw redesign, voter-anonymization, BR-34 tenure — deferred / V2.
6. TDD: write the failing test FIRST for each fix (watch it fail for the right reason), implement the smallest correct fix, re-run. Use the module's existing test harness; do not weaken assertions or fake-green.
7. Validate: focused tests → module tests → full `bun test` (api-ts) → `bun run --filter '*' typecheck`. Save the fix report (APPEND a "Batch B" section to `elections-governance-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- **A2. Elections Batch B (FIX-003 + FIX-005) — THIS PASS.**
- A3. Auth/RBAC Batch E (FIX-010 INVITE_TOKEN_SECRET) + Batch B cleanup.
- A4. Billing Batch B remainder (FIX-007 updateInvoice txn, FIX-008 void path).
- A5. Communications Batch B (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + confirm DEC-COMMS-05 scoping).
- A6. Documents Batch B2 (FIX-007 cron, FIX-010 notif gate, FIX-011 audit consumer).
- A7. Notifications Batch C subset (FIX-007 suppression DELETE, FIX-010 queue-lifecycle hurl, FIX-012 orgId guard).
- A8. Person Batch C decision-free subset (FIX-007…014; exclude Q-1/Q-4).
- A9. Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06).
- A10. Platform-admin Batch B decision-free subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11. Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12. Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13. Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Track B — decision-gated (the bottleneck):**
- B1. **Resolve the 3 P0 product decisions:** elections **G2 position-identity** → documents **Q1 card-verify token** → realtime **PD-1 channel-membership model**. Then headline P1s (training TC-DEC-01/02, person Q-4+Q-1, documents Q8, notifs Q3). Full ranked agenda in roadmap §13.
- B2. Per-module gated `04` passes once unblocked (jobs needs jobs-D1 eng-confirm; surveys needs PD-1/2/3).

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Membership Batch C, 2026-06-12)

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. No new migration in Batch C; elections Batch B should need none (FIX-003/005 are handler/guard fixes — confirm). Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`.
- Known-good baselines: full `bun test` (api-ts) = **6059 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors**. Hurl (last-known, not re-run in Batch C) = **152/155** (pre-existing flakies: impersonation 403→400, platformadmin committees 403→200, `member/governance/position-crud.hurl` intermittent — relevant to elections; re-run after Batch B). `check:sdk-compat` exits 1 **by design** — frozen baseline `docs/quality/SDK_BASELINE_OPS.json` must **NOT** be `--update`d until milestone Step 6.
- A test-only `makeMockDb` helper in `services/api-ts/src/test-utils/make-ctx.ts` now exposes an additive `insert(...).values()` capture + `_inserted` array (from Batch C) — reuse it for status-history/audit-row assertions.

## Tree / commit rules

- NOTHING committed; working tree dirty (~230+ files across all prior AHA passes + Batch C). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY elections-governance Batch B (decision-free subset). Do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
