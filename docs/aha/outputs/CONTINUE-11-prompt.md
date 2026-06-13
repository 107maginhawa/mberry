# Continuation prompt — AHA Step 11 (next `04`: Communications Batch B — FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-11-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). It modifies source + tests (and, for FIX-006, TypeSpec + a regen of generated files). Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch other modules, do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Communications (+ feed), Batch B (FIX-006 + FIX-007 + FIX-008, plus the DEC-COMMS-05 self/officer scoping that folds into B)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE
03-organize-gap-plan-for-fixing.md     # DONE
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Billing (Stripe) Batch B remainder (FIX-007 + FIX-008), 2026-06-12** — COMPLETE. **FIX-007** added a transactional `InvoiceRepository.replaceLineItems` (delete → insert → update totals in one `db.transaction`, reusing the `createWithLineItems` pattern); `updateInvoice.ts` routes line-item updates through it so persisted `total == sum of stored rows` (AC-M21-002). **FIX-008** restructured `voidInvoice.ts` to status-based guards (SM-M21-INVOICE Draft/Open → Void): terminal-state 409s + `INVOICE_NOT_VOIDABLE`, then `requires_capture` → existing Stripe-cancel path (kept byte-identical) vs `else` → standard no-charge void; flipped 2 spec-divergent tests (`voidInvoice.test.ts`, `lifecycle.test.ts`) — corrected, not weakened. No migration, no generator, `core/billing.ts` untouched. Billing Batch B (FIX-003..008) now fully landed. See `docs/aha/module-fix-plans/billing-stripe-fix-report.md` § "Batch B Remainder — FIX-007 + FIX-008".
- **`04` Communications Batch A (FIX-001..005), prior pass** — COMPLETE. P0 delivery spine + prefs pipeline: `registerCommunicationJobs` wired into `initializeApp` + `announcement.published` subscriber (FIX-001/002); compose UI chains create → publish/schedule (FIX-003); `listPersonSubscriptions` returns contract `{data,pagination}` (FIX-004); `bulkUpdatePersonSubscriptions` resolves synthetic topic keys → seeded topic UUIDs via `findOrCreateByName` (FIX-005, no schema column). **Batch B (FIX-006/007/008) was explicitly deferred — THIS PASS.** See `docs/aha/module-fix-plans/communications-fix-report.md`.

## This pass — execute `04` for Communications (+ feed), Batch B (FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05)

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/communications-fix-ready-plan.md` (§3 Active Scope FIX-006/007/008, §4 Batch B, §5 Test-First rows FIX-006/007/008, §7 deps, §8 confirmations).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/communications-gap-plan.md`
   - Prior fix report (what's already done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/communications-fix-report.md` (Batch A FIX-001..005 complete).
   - Module slug = `communications`. Readable name = "Communications (+ feed)".
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected subset — decision-free:**
   - **FIX-006 — Officer RBAC re-role (P1).** 18 communication ops require literal `["admin","coordinator"]`; the `coordinator` role does not exist and officers lack `admin` → they are 403'd on templates/topics/segments/messages. Spec §6/WF-047 assigns these to Officers. Fix: re-role those ops in `specs/api/src/association/core/communication.tsp` to the officer model (`association:officer` / `x-require-position`, matching how other officer-gated ops in the same TypeSpec are declared — **read the existing officer-gated ops first and mirror them; do NOT invent a new role string**), then **regenerate** `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` via `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`. NEVER hand-edit generated files. RED-first: add an RBAC test where a seeded **officer** can CRUD templates/topics/segments → 2xx (currently 403). **Decision-free** (spec-assigned; mirror existing officer ops).
   - **FIX-007 — Cross-org announcement mutation (P1).** publish/update/delete/archive fetch the announcement by id with no org match; the position check resolves org from the caller header, not the record → an Org A officer can mutate an Org B announcement by id. The `repo.get(id, orgId?)` signature is **already confirmed to accept an org param** (per Batch A fix report §10) — so add the org scope on fetch (or a post-fetch `existing.organizationId === ctxOrgId` assert) in `publishAnnouncement.ts`, `updateAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts`. RED-first: Org A officer → Org B announcement by id → 403/404. **Decision-free** (signature confirmed).
   - **FIX-008 — Delivery stats surfacing (P1).** Analytics reads stats off a list endpoint that never joins/populates `announcement_stats`; stats are only written by the (now-live, post-Batch-A) fan-out. Fix: populate/join stats on the list + `getAnnouncementStats` path (`communication.repo.ts:262-276`, `getAnnouncementStats.ts`) so WF-048 shows real data. RED-first: after a publish drives the fan-out, stats are non-empty and the stats/list endpoint returns them. **Decision-free** (Batch A delivery is live — unblocked).
   - **DEC-COMMS-05 — `listPersonSubscriptions` self/officer PII scoping (P1, folds into B).** The handler scopes by org only, not by self/officer on `query.personId` → a member may read another member's consent/subscription records. Eng-verify the current scoping, then add a self-or-officer guard on `personId`. RED-first: member A requesting member B's subscriptions → 403 (or self-scoped). **Decision-free** (eng-confirm, no product decision).
5. **Do NOT** implement in this pass (out of subset / later batches):
   - **FIX-001 / FIX-002 / FIX-003 / FIX-004 / FIX-005** — already DONE (Batch A). Do not redo.
   - **FIX-009 / FIX-010 / FIX-011** (Batch C — in-app mandatory server guard, template render fallback + Handlebars validation, m07 §10 / HAND_WIRED_ROUTES doc correction) — **Excluded** (separate `04` pass).
   - Professional feed (m13) — **Excluded** (`[NEEDS PRODUCT DECISION]` / `[BLOCKED BY MISSING SPEC]`).
   - A parallel **messages** delivery pipeline — **Excluded** (`[DO NOT OVERBUILD]`; canonical primitive defaulted to announcements).
   - Per-channel prefs `channel` column + migration; M7-R6 priority push; announcement `cancelled` state; saved-segment smart audiences; title 200-vs-300 reconciliation; feed/survey schema co-location — **Excluded** (deferred / route to `06`).
   - Do NOT modify email/notifs job internals (wire/read only the communication side). Do NOT touch the shared event-bus bootstrap beyond what Batch A already landed.
6. TDD: write the failing test FIRST for each fix (watch it fail for the right reason — FIX-006: officer 403 on a CRUD op; FIX-007: cross-org mutation succeeds; FIX-008: stats empty after publish; DEC-COMMS-05: member reads another member's subs), implement the smallest correct fix, re-run. Do not weaken assertions or fake-green. The inline `ac-m07.*` / `br-*` tests "prove nothing about real code paths" (plan §5 note) — do NOT treat them as coverage; drive AC-M07 through real handlers.
7. Validate: focused tests per fix → affected dir (`bun test src/handlers/communication`) → if FIX-006 regen ran, confirm only communication routes changed in the generated diff → full `bun test` (api-ts) → `bun run --filter '*' typecheck`. Save the fix report (APPEND a "Batch B — FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05" section to `communications-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- A2. Elections Batch B (FIX-003 + FIX-005) — ✅ DONE (2026-06-12).
- A3. Auth/RBAC Batch E (FIX-010 INVITE_TOKEN_SECRET) + Batch B cleanup — ✅ DONE (2026-06-12, PARTIAL: `officerAuthMiddleware` deletion deferred — see carry-forward).
- A4. Billing (Stripe) Batch B remainder (FIX-007 updateInvoice txn, FIX-008 unpaid-void) — ✅ DONE (2026-06-12).
- **A5. Communications Batch B (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + DEC-COMMS-05 scoping) — THIS PASS.**
- A6. Documents Batch B2 (FIX-007 cron, FIX-010 notif gate, FIX-011 audit consumer).
- A7. Notifications Batch C subset (FIX-007 suppression DELETE, FIX-010 queue-lifecycle hurl, FIX-012 orgId guard).
- A8. Person Batch C decision-free subset (FIX-007…014; exclude Q-1/Q-4).
- A9. Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06).
- A10. Platform-admin Batch B decision-free subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11. Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12. Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13. Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose end (small, decision-free-ish eng-confirm — slot anytime):**
- **Auth/RBAC `officerAuthMiddleware` dead-triplet.** Decide whether `src/tests/route-protection-handwired.test.ts` (198 LOC; mounts `officerAuthMiddleware` in mock apps to document a never-adopted wiring — real protection is now covered by `route-registry-rbac.test.ts` + inline `requireOfficerTerm` tests) is obsolete. If yes → delete `middleware/officer-auth.ts` + `officer-auth.test.ts` + `route-protection-handwired.test.ts` together (the dead triplet). If no → keep them and amend `ROLE_PERMISSION_MATRIX.md` to stop calling `officerAuthMiddleware` deletable. Eng-confirm (consider a `/codex` second opinion), NOT a product decision. Full context in `auth-rbac-fix-report.md` § "Batch E + Batch B cleanup" → "Still open".

**Track B — decision-gated (the bottleneck):**
- B1. **Resolve the 3 P0 product decisions:** elections **G2 position-identity** → documents **Q1 card-verify token** → realtime **PD-1 channel-membership model**. Then headline P1s (training TC-DEC-01/02, person Q-4+Q-1, documents Q8, notifs Q3) **plus the auth-rbac gated set: FIX-008 analyst bypass + G3 session-role model + impersonation/403-logging**, and **billing Batch E** (capture-method behavior). Full ranked agenda in roadmap §13.
- B2. Per-module gated `04` passes once unblocked (jobs needs jobs-D1 eng-confirm; surveys needs PD-1/2/3).

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Billing A4, 2026-06-12)

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **FIX-007/008/DEC-COMMS-05 are handler + repo logic; FIX-006 is a TypeSpec re-role + generated-file regen — none need a NEW migration.** Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`.
- Known-good baselines (current, AFTER Billing A4): full `bun test` (api-ts) = **6083 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors** (5/5 workspaces). After this pass, expect: +N for the new FIX-006/007/008/DEC-COMMS-05 RBAC + tenant + stats + scoping tests; full count rises, no regression. `check:sdk-compat` exits 1 **by design** — frozen baseline `docs/quality/SDK_BASELINE_OPS.json` must **NOT** be `--update`d until milestone Step 6 (the FIX-006 regen will legitimately change the SDK/generated surface — that is expected; do NOT re-freeze the baseline).
- **FIX-006 regen note:** re-roling 18 ops in `communication.tsp` then running `bun run build` + `bun run generate` WILL modify `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` and may ripple into `packages/sdk-ts/src/generated/*`. This is the intended fix output, not a tree violation. Restart the API server after regen (no hot-reload for new/changed route registration). Verify the generated diff is confined to communication routes.

## Tree / commit rules

- NOTHING committed; working tree dirty (~245 files across all prior AHA passes + Billing A4: 3 billing handlers/repo + 4 billing test files). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass is source + test + TypeSpec ADDs/edits + an intended generated-file regen (FIX-006) — no file deletes. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Communications Batch B (FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05) (decision-free subset). Do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
