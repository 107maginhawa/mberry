# Continuation prompt — AHA Step 10 (next `04`: Billing (Stripe) Batch B remainder — FIX-007 + FIX-008)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-10-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). It modifies source + tests. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch other modules, do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Billing (Stripe), Batch B remainder (FIX-007 + FIX-008, decision-free subset)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

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

- **`04` Auth/RBAC Batch E (FIX-010) + Batch B cleanup (2026-06-12)** — PARTIALLY COMPLETE. **FIX-010** (`INVITE_TOKEN_SECRET` prod fail-fast in `core/config.ts`, mirrors the `INTERNAL_SERVICE_TOKEN` pattern — server refuses to boot when `NODE_ENV==='production'` and the secret is unset OR equals the dev default `'dev-secret-change-in-production'`) landed RED→GREEN (config.test.ts 73/2 → 75/0; deterministic — hardened the 4 prior prod tests off ambient env). **Batch B cleanup:** deleted dead `requireOrgRole`/`hasMinimumRole` (+ orphaned `ROLE_HIERARCHY`/`OrgRole`) from `utils/org-auth.ts` + their tests (grep-proven zero prod callers; kept `requireActiveStatus`/`requireTenantAccess`). **Deferred:** `officerAuthMiddleware` deletion — discovered NOT pure-dead (`src/tests/route-protection-handwired.test.ts` is a live passing test that imports/mounts it). See `docs/aha/module-fix-plans/auth-rbac-fix-report.md` § "Batch E + Batch B cleanup". Config-only + delete-only — no migration/regen.
- **`04` Billing (Stripe) Batch A + Batch B (partial), 2026-06-11** — Batch A (FIX-001 secret-log redaction, FIX-002 indexed webhook lookup + migration `0063`) + Batch B partial (**FIX-003** listInvoices self-scoping, **FIX-004** webhook idempotency, **FIX-005** payInvoice status-guard, **FIX-006** failed-retry) **COMPLETE**. See `docs/aha/module-fix-plans/billing-stripe-fix-report.md`. **FIX-007** (`updateInvoice` transactional line-item replacement) and **FIX-008** (unpaid-invoice void path) were explicitly deferred to a later Batch B pass — THIS PASS.

## This pass — execute `04` for Billing (Stripe), Batch B remainder (FIX-007 + FIX-008)

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md` (§3 Active Scope, §4 Batch B, §5 Test-First rows FIX-007/FIX-008).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/billing-stripe-gap-plan.md`
   - Prior fix report (what's already done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/billing-stripe-fix-report.md` (Batch A + Batch B FIX-003..006 complete).
   - Module slug = `billing-stripe`. Readable name = "Billing (Stripe)".
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected subset — decision-free only:**
   - **FIX-007 — `updateInvoice` transactional line-item replacement (AC-M21-002).** `handlers/billing/updateInvoice.ts` replaces invoice line items non-transactionally and/or lets persisted totals drift from the line rows. Fix: add a transactional repo method (e.g. `replaceLineItems`) to `handlers/billing/repos/billing.repo.ts` that deletes + re-inserts line items and recomputes the invoice total **in one transaction**, and have `updateInvoice.ts` call it. RED-first: extend `handlers/billing/updateInvoice.test.ts` (+ a repo test) to assert **reloaded rows == request rows** and **persisted total == sum of rows**. Use the existing Drizzle transaction pattern already in the billing repos — do NOT invent a new tx abstraction. **Decision-free.**
   - **FIX-008 — unpaid-invoice void path.** `handlers/billing/voidInvoice.ts` currently diverges from spec (the existing `voidInvoice.test.ts` asserts the spec-divergent behavior). Fix: allow voiding an **unpaid open/finalized** invoice (Finalize → void with no payment → 200/void) while keeping the **authorized-payment void path intact** (do not break the path that releases an authorized-but-uncaptured payment). RED-first: flip `handlers/billing/voidInvoice.test.ts` to assert the correct behavior (it currently encodes the wrong behavior as correct — update those assertions to the spec, watch them fail, then fix). **Decision-free.**
5. **Do NOT** implement in this pass (out of subset / later batches):
   - **FIX-003 / FIX-004 / FIX-005 / FIX-006** — already DONE (Batch B partial, 2026-06-11). Do not redo.
   - **FIX-009 / FIX-010 / FIX-012 / FIX-013** (Batch C — financial actor columns, cumulative partial refunds, payload-shape items) — **Excluded** (separate `04` pass).
   - **FIX-011** (invoice-number race / per-org numbering, Batch F — advisory-lock/sequence + schema/migration) — **Excluded**.
   - **Batch E** (any `core/billing.ts` capture-method behavior change) — DEFERRED behind a product decision. **Excluded.**
   - Do NOT add a new migration or run the generator — FIX-007/008 are handler + repo logic on existing tables (no schema change). If you believe a schema change is required, STOP and document it as blocked rather than expanding scope.
6. TDD: write the failing test FIRST for each fix (watch it fail for the right reason — FIX-007: persisted total/rows mismatch the request; FIX-008: unpaid void rejected or wrong status), implement the smallest correct fix, re-run. Do not weaken assertions or fake-green. For FIX-008 specifically, the existing test encodes the WRONG behavior — rewriting those assertions to the spec is expected (a corrected test, not a weakened one); note it explicitly in the report.
7. Validate: focused tests → `handlers/billing/updateInvoice.test.ts` + `handlers/billing/voidInvoice.test.ts` + `handlers/billing/repos/billing.repo.test.ts` → affected dir (`bun test src/handlers/billing`) → full `bun test` (api-ts) → `bun run --filter '*' typecheck`. Save the fix report (APPEND a "Batch B remainder — FIX-007 + FIX-008" section to `billing-stripe-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- A2. Elections Batch B (FIX-003 + FIX-005) — ✅ DONE (2026-06-12).
- A3. Auth/RBAC Batch E (FIX-010 INVITE_TOKEN_SECRET) + Batch B cleanup — ✅ DONE (2026-06-12, PARTIAL: `officerAuthMiddleware` deletion deferred — see carry-forward below).
- **A4. Billing (Stripe) Batch B remainder (FIX-007 updateInvoice txn, FIX-008 unpaid-void) — THIS PASS.**
- A5. Communications Batch B (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + confirm DEC-COMMS-05 scoping).
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

## Env state (after Auth/RBAC A3, 2026-06-12)

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **FIX-007/008 are handler + repo logic on existing tables — neither needs a migration or generator regen.** Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`.
- Known-good baselines (current, AFTER Auth/RBAC A3): full `bun test` (api-ts) = **6079 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors** (5/5 workspaces). After this pass, expect: +N for the new FIX-007/008 cases (`updateInvoice.test.ts`, `voidInvoice.test.ts`, repo test) and any corrected (NOT weakened) FIX-008 assertions; full count rises, no regression. `check:sdk-compat` exits 1 **by design** — frozen baseline `docs/quality/SDK_BASELINE_OPS.json` must **NOT** be `--update`d until milestone Step 6.
- Carry-forward verify (from billing Batch A): on the next API server boot / migration run, confirm migration `0063` applies and both `invoices_metadata_payment_intent_idx` and `invoices_metadata_transfer_idx` exist. Not required for this pass.
- A test-only `makeMockDb` helper in `services/api-ts/src/test-utils/make-ctx.ts` exposes an additive `insert(...).values()` capture + `_inserted` array — reuse if the `replaceLineItems` repo write needs asserting (FIX-007).

## Tree / commit rules

- NOTHING committed; working tree dirty (~245 files across all prior AHA passes + Auth/RBAC A3: `core/config.ts` + `core/config.test.ts` + `utils/org-auth.ts` + `utils/org-auth.test.ts`). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass is source + test ADDS only (no file deletes). Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Billing (Stripe) Batch B remainder (FIX-007 + FIX-008) (decision-free subset). Do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
