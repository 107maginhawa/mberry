# Continuation prompt — AHA Step 07 (consolidate roadmap) + remaining-work sequence

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-07-prompt.md`.

> This is a **`07-consolidate-roadmap.md`** pass (consolidation, NOT a fix pass). Do NOT fix anything. Do NOT rewrite existing gap plans, fix-ready plans, or fix reports. Goal: re-consolidate all AHA findings now that the last decision-gated module batch (membership E2/F) has landed, and emit the ordered "what to fix next + what needs product decision" agenda.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/07-consolidate-roadmap.md`** to refresh the consolidated remediation roadmap, then STOP and present the product-decision agenda + the ordered next-`04` list.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE (module-audit-index.md)
02-module-or-group-audit-gap-plan.md   # DONE (15 *-gap-plan.md)
03-organize-gap-plan-for-fixing.md     # DONE (15 *-fix-ready-plan.md)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE — repeats until all batches cleared
05-cross-cutting-pattern-audit.md      # DONE (cross-cutting audit + F-1..F-5 fixes)
06-database-schema-audit.md            # DONE (schema audit; R-5 resigned_at executed in the membership E2/F pass)
07-consolidate-roadmap.md              # RUN ONCE; RE-RUN NOW (this pass)
```

Rules: never skip `02`→`04`; never run `04` without a `03` fix-ready plan; `07` is read-only (no fixes, no plan rewrites).

## What just completed (do NOT redo)

- **Membership Lifecycle Batch F + E2 + FIX-013** — COMPLETE and adversarially verified. See `docs/aha/module-fix-plans/membership-lifecycle-fix-report.md` (section "Batch F + E2 (2026-06-12)"). The six §8 product decisions that gated E2/F were RESOLVED 2026-06-12 and implemented (reinstate=lapsed-only, resign=officer-only + `resigned_at`, EXPIRED dropped from V1, expulsion deferred to V2, re-application=reuse-row, delete\* ops removed). Migrations `0065` (`resigned_at` + backfill) and `0066` (audit_action `suspend`/`unsuspend`) applied.
- All prior AHA module `04` passes + cross-cutting `05` (F-1..F-5) + database `06` (R-1/R-2/R-5) + env pass — DONE.

## Current per-module state (quick scan, 2026-06-12)

`04` has run once for every module; "COMPLETE" = the *selected batch* finished (deferred batches + gated decisions can still remain). Gated = count of `[NEEDS PRODUCT DECISION]` in each fix-report (63 total).

| Module | Executed-batch verdict | Gated decisions | Notes |
|---|---|---|---|
| platform-admin | PARTIAL | 8 | heaviest decision cluster |
| elections-governance | COMPLETE | 7 | incl. **G2 position-identity (P0)** |
| auth-rbac | COMPLETE | 6 | |
| dues-payments | (prose) | 5 | |
| person-profile | PARTIAL | 5 | incl. **gender-scrub Q-4 (P1)** |
| surveys-polls | COMPLETE | 5 | |
| membership-lifecycle | COMPLETE (E2/F) | 5 → **RESOLVED** | only **Batch C** remains (no decisions) |
| communications | (prose) | 4 | |
| notifications-email | PARTIAL | 4 | |
| training-credits | PARTIAL | 4 | incl. **paid-training / manual-entry (P1)** |
| billing-stripe | COMPLETE | 3 | |
| marketplace-advertising | COMPLETE | 3 | |
| realtime-comms | COMPLETE | 3 | |
| documents-credentials | PARTIAL | 1 | incl. **Q8 / cert (P1)** |
| jobs | COMPLETE | 0 | |
| cross-cutting-platform | (prose) | 0 | |

## This pass — execute `07`

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`.
2. Run `docs/aha/prompts/07-consolidate-roadmap.md`. It loads `module-audit-index.md`, all `*-gap-plan.md`, the `*-fix-ready-plan.md`s, and all `*-fix-report.md`s, then UPDATES `docs/aha/outputs/consolidated-remediation-roadmap.md` (the prior one is stale — pre-membership-E2/F).
3. The roadmap must decide, across all modules: what is already fixed · what is planned-but-incomplete · what to fix next · what to defer · **what needs product decision** (consolidate the 63 gated items, ranked P0→P3) · what should not be built · which AHA prompt runs next.
4. STOP. Present (a) the consolidated **product-decision agenda** (P0/P1 first) and (b) the ordered **next-`04`** list.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — no product decision needed (can run anytime, in parallel):**
- A1. Membership **Batch C** — `04` pass (FIX-005 approve-event-emit, FIX-006 status-history, FIX-012, FIX-014 renew-cycle, FIX-015 tier-delete gate, FIX-016 import hardening, FIX-017 roster q-search, FIX-018 status badges, FIX-020 grace-range). Fix-ready plan §4 already exists.

**Track B — decision-gated (the bottleneck; this `07` pass produces its agenda):**
- B1. **Run `07`** (this pass) → consolidated roadmap + ranked decision agenda.
- B2. **Resolve product decisions**, P0/P1 first: elections **G2 position-identity (P0)** → training **paid-training + manual-entry (P1)** → person **gender-scrub Q-4 (P1)** → documents **Q8 + cert (P1)** → then P2/P3 (platform-admin, auth-rbac, dues, surveys, comms, notifs, billing, marketplace, realtime).
- B3. **Per-module `04` follow-up passes** for the now-unblocked batches, in the roadmap's order (one per module, mirroring the membership E2/F pass).

**Track C — consolidate + ship (after A + B land):**
- C1. **Re-run `07`** to re-consolidate.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`.
- An API instance from the prior pass may still be running on `:7213` (`/tmp/memberry-api.log`). `07` is read-only and does not need it; kill it if stale.
- Known-good baselines AFTER membership E2/F: full `bun test` (api-ts) = **6030 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors**. Hurl = **152/155** (pre-existing flakies: impersonation 403→400, platformadmin committees 403→200, `member/governance/position-crud.hurl` intermittent). `check:sdk-compat` exits 1 **by design** — `deleteMembership`/`deleteMembershipApplication` removed (decision #6) + pre-existing marketplace/jobs/advertising path drift; the frozen baseline `docs/quality/SDK_BASELINE_OPS.json` must **NOT** be `--update`d until milestone Step 6.

## Tree / commit rules

- NOTHING committed; working tree dirty (~190+ files across all prior AHA passes). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 prompt sequence, §22 roadmap rules, §23 stop conditions). Primary guide for this pass: `docs/aha/prompts/07-consolidate-roadmap.md`. `07` does NOT fix code and does NOT rewrite any gap plan / fix-ready plan / fix report.

execute systematically
