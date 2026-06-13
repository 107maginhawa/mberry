# Continuation prompt — AHA Step 13 (next `04`: Notifications & Email — Batch C subset = FIX-007 + FIX-010 + FIX-012)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-13-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). It modifies source + tests + ONE TypeSpec op (FIX-007 adds `DELETE /email/suppressions/:id`, so this pass DOES run the generator — unlike the last one). FIX-010 is a contract-test rewrite; FIX-012 is a small repo guard. No database migration. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch other modules, do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Notifications & Email, Batch C subset (FIX-007 `DELETE /email/suppressions/:id` + FIX-010 real queue-lifecycle hurl + FIX-012 `organizationId` guard)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

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

- **`04` Documents & Credentials Batch B2 (FIX-007 cron + FIX-010 notif gate + FIX-011 audit consumer), 2026-06-12** — COMPLETE. **FIX-007** added a new daily cron `member.licenseRenewalProcessor` (`'0 1 * * *'`) in `association:member/jobs/index.ts` + new `licenseRenewalProcessor.ts` that scans active professional licenses within `[7,14,30,60,90]`-day windows and inserts idempotent `license_renewal_alert` rows keyed `(licenseId, window)` (the previously-missing producer; mirrors `dues.reminderProcessor`). **FIX-010** gated the `training.completed` "Certificate Available" notification on a non-revoked certificate existing for the training+person (no cert → no notification) — one in-block change in `core/domain-event-consumers.ts`. **FIX-011** added a `verification.requested` consumer in the same file that writes a tamper-evident `audit_log_entry` via `AuditRepository.logEvent` (`compliance`/`association`/`read`, outcome=verified?success:failure) — sink chosen because no `credential_verification_log` table exists (only a TypeSpec model) and no migration was allowed. Full `bun test` = **6101 pass / 1 fail (pre-existing `registerEmailJobs`) / 4 todo**; typecheck 0 errors (5/5). No TypeSpec/migration/regen. See `docs/aha/module-fix-plans/documents-credentials-fix-report.md` § "Batch B2".
- **`04` Notifications & Email prior passes** — Batch D (FIX-001 BR registration, partial-by-honesty) + Batch B BR-57 slice (FIX-002 reason-aware transactional Guard 1) + FIX-008 (enqueue-time validation) are DONE. See `docs/aha/module-fix-plans/notifications-email-fix-report.md`. **Batch C remainder (FIX-007/010/012) was NOT done — THIS PASS.**

## This pass — execute `04` for Notifications & Email, Batch C subset

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/notifications-email-fix-ready-plan.md` (§3 rows FIX-007/010/012, §4 Batch C, §5 Test-First rows FIX-007/010/012, §6 files, §7 deps, §8 decisions).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/notifications-email-gap-plan.md`
   - Prior fix report (what's already done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/notifications-email-fix-report.md` (Batch D + B BR-57 + FIX-008 complete).
   - Module slug = `notifications-email`. Readable name = "Notifications & Email".
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected subset — decision-free:**
   - **FIX-007 — `DELETE /email/suppressions/:id` (P2, V1 RECOMMENDED, Batch C, WF-125).** Today `email.tsp:645-651` exposes GET-only; there is no delete handler, so an admin cannot unblock a wrongly/typo-suppressed address without DB surgery (WF-125 is half-missing). Fix: add the DELETE operation in `specs/api/src/modules/email.tsp` with an `@extension("x-audit", ...)` declaration, mirror the **existing email-suppression GET endpoint's RBAC** (admin-tier; non-admin → 403), regenerate (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`), then implement `handlers/email/deleteEmailSuppression.ts`. RED-first: admin removes a suppression (200 + row gone); non-admin → 403; audit event emitted. **This pass DOES run the generator** (additive op). **Decision-free** — no product decision; just completes WF-125.
   - **FIX-010 — Real queue-lifecycle contract test (P2, V1 RECOMMENDED, Batch D/C).** `specs/api/tests/contract/email-extended-flow.hurl` cancel/retry steps use a placeholder UUID with `HTTP *` (route-exists only — proves nothing about the transition). Fix: rewrite those steps as a real enqueue → cancel → retry lifecycle against a seeded item. RED-first: the rewritten hurl exercises actual cancel/retry transitions. **Run it against the live API** (Docker up; DB `localhost:5432/monobase` migrated 0066 + seeded — boot the api-ts server and run via `scripts/run-contract-tests.ts` / the test-contract skill against `$API_URL`). If the API impl/DB is genuinely unavailable, author the corrected hurl and mark validation `[BLOCKED BY ENVIRONMENT]` (do NOT fake-green). **Decision-free.**
   - **FIX-012 — `organizationId` guard in `notification.repo.ts` (P3, V1 RECOMMENDED, Batch C).** `notification.repo.ts:145` does `organizationId: request.organizationId || ''` against a notNull uuid column → a Postgres uuid cast error at runtime if any internal caller omits orgId (`InternalNotificationRequest.organizationId?` is optional). Fix: add early validation so `createNotificationForModule` throws a `ValidationError` (not a DB cast error) when orgId is missing/empty. RED-first: missing `organizationId` → `ValidationError`. **Decision-free** — `[NEEDS CONFIRMATION]` whether any caller actually omits it, but the guard is correct + cheap regardless.
5. **Do NOT** implement in this pass (out of subset / blocked / later):
   - **FIX-001 / FIX-002 / FIX-008** — already DONE (prior passes). Do not redo.
   - **FIX-003** (bounce/complaint webhook ingestion, Batch E) — **Excluded** (`[BLOCKED BY ENVIRONMENT]` Q2: provider + webhook signature shape).
   - **FIX-004 / FIX-005** (preference enforcement + UI convergence, Batch B) — **Excluded** (`[NEEDS PRODUCT DECISION]` Q3: which preference store wins — person `notification_preference` vs communication `person_subscriptions`).
   - **FIX-006** (web push) — **Excluded** (`[NEEDS PRODUCT DECISION]` Q1: push scope).
   - **FIX-009** (Q4 confirmation), **FIX-011** (doc reconciliation, may need Q5), **FIX-013** — **Excluded** (not in this subset).
   - Everything in fix-ready §10 (Deferred — admin UI screens for email queue/templates/suppressions: NAVIGATION_MAP declares API-only V1) and §11 (Do Not Build). Eventual preference-table deprecation is a prompt-06 concern — do NOT alter schema.
6. TDD: write the failing test FIRST for each fix (watch it fail for the right reason — FIX-007: no DELETE op/handler (404/route-missing) + RBAC; FIX-010: placeholder `HTTP *` proves no transition; FIX-012: missing orgId currently `|| ''` casts/throws a DB error not a ValidationError), implement the smallest correct fix, re-run. Do not weaken assertions or fake-green. FIX-007 unit: `handlers/email/deleteEmailSuppression.test.ts` (admin 200 + row gone; non-admin 403; audit emitted) + extend `specs/api/tests/contract/email.hurl`. FIX-012 unit: `handlers/notifs/repos/notification.repo.test.ts`.
7. **Shared-file / regen discipline:** FIX-007 is the only fix that touches the TypeSpec→generated pipeline — keep it the SOLE contract change in this pass; **never hand-edit `generated/**`** (routes/validators/registry/types). After regen, **verify the regen is confined** to the new `deleteEmailSuppression` op (routes.ts + openapi.json + validators/types for that op only) and run `check:sdk-compat` (it will now show the **new `deleteEmailSuppression` operationId** added to the SDK surface — that is expected; do NOT `--update` the frozen baseline `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6). FIX-010 edits only the hurl file; FIX-012 edits only `notification.repo.ts` (module-local). NO database migration this pass.
8. Validate: focused tests per fix → affected dirs (`bun test src/handlers/email src/handlers/notifs`) → full `bun test` (api-ts) → `bun run --filter '*' typecheck` → FIX-010 contract run against `$API_URL` (or `[BLOCKED BY ENVIRONMENT]`). Save the fix report (APPEND a "Batch C subset — FIX-007 + FIX-010 + FIX-012" section to `notifications-email-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- A2. Elections Batch B (FIX-003 + FIX-005) — ✅ DONE (2026-06-12).
- A3. Auth/RBAC Batch E (FIX-010 INVITE_TOKEN_SECRET) + Batch B cleanup — ✅ DONE (2026-06-12, PARTIAL: `officerAuthMiddleware` deletion deferred — see carry-forward).
- A4. Billing (Stripe) Batch B remainder (FIX-007 updateInvoice txn, FIX-008 unpaid-void) — ✅ DONE (2026-06-12).
- A5. Communications Batch B (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + DEC-COMMS-05 scoping) — ✅ DONE (2026-06-12).
- A6. Documents Batch B2 (FIX-007 cron, FIX-010 notif gate, FIX-011 audit consumer) — ✅ DONE (2026-06-12).
- **A7. Notifications Batch C subset (FIX-007 suppression DELETE, FIX-010 queue-lifecycle hurl, FIX-012 orgId guard) — THIS PASS.**
- A8. Person Batch C decision-free subset (FIX-007…014; exclude Q-1/Q-4).
- A9. Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06).
- A10. Platform-admin Batch B decision-free subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11. Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12. Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13. Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose end (small, decision-free-ish eng-confirm — slot anytime):**
- **Auth/RBAC `officerAuthMiddleware` dead-triplet.** Decide whether `src/tests/route-protection-handwired.test.ts` (198 LOC; mounts `officerAuthMiddleware` in mock apps to document a never-adopted wiring — real protection is now covered by `route-registry-rbac.test.ts` + inline `requireOfficerTerm` tests) is obsolete. If yes → delete `middleware/officer-auth.ts` + `officer-auth.test.ts` + `route-protection-handwired.test.ts` together. If no → keep them and amend `ROLE_PERMISSION_MATRIX.md`. Eng-confirm (consider a `/codex` second opinion), NOT a product decision. Full context in `auth-rbac-fix-report.md` § "Batch E + Batch B cleanup" → "Still open".

**Track B — decision-gated (the bottleneck):**
- B1. **Resolve the 3 P0 product decisions:** elections **G2 position-identity** → documents **Q1 card-verify token** → realtime **PD-1 channel-membership model**. Then headline P1s (training TC-DEC-01/02, person Q-4+Q-1, documents Q8, **notifs Q3 preference-store owner**) **plus the auth-rbac gated set: FIX-008 analyst bypass + G3 session-role model + impersonation/403-logging**, and **billing Batch E** (capture-method behavior). Full ranked agenda in roadmap §13.
- B2. Per-module gated `04` passes once unblocked (notifs FIX-003 behind Q2, FIX-004/005 behind Q3, FIX-006 behind Q1; documents Batch A behind Q1; documents Batch C behind Q8 + Batch F migration; jobs needs jobs-D1 eng-confirm; surveys needs PD-1/2/3).

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Documents B2, 2026-06-12)

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **FIX-007 needs a TypeSpec op + generator regen (NO migration); FIX-010 is a contract-test rewrite that needs the running API + seeded DB to validate; FIX-012 is a module-local repo guard.** Query DB via `bun -e` (or a guarded DB-integration test) against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase` (bun auto-loads `services/api-ts/.env`). For FIX-010, boot the api-ts server (`cd services/api-ts && bun dev`, port 7213) and run the contract suite against `$API_URL`.
- Known-good baselines (current, AFTER Documents B2): full `bun test` (api-ts) = **6101 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors** (5/5 workspaces). After this pass, expect: +N for the FIX-007 handler + FIX-012 guard unit tests; full count rises, no regression.
- `check:sdk-compat` exits 1 **by design** — the frozen baseline `docs/quality/SDK_BASELINE_OPS.json` reflects prior pending TypeSpec work (governance `closeElectionVoting`, Communications FIX-006 regen). **This pass ADDS 1 operationId (`deleteEmailSuppression`)** via FIX-007 — that new op SHOULD appear in the SDK surface diff; do **NOT** `--update` the baseline until milestone Step 6.

## Tree / commit rules

- NOTHING committed; working tree dirty (~260+ files across all prior AHA passes + Documents B2: the new `licenseRenewalProcessor.ts`/`.test.ts`, jobs index + test, `domain-event-consumers.ts` + test). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass is source + test ADDs/edits + ONE TypeSpec op + its intended regen — no unrelated file deletes. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Notifications & Email Batch C subset (FIX-007 + FIX-010 + FIX-012) (decision-free subset). Do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
