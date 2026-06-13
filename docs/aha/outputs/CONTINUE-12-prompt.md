# Continuation prompt — AHA Step 12 (next `04`: Documents & Credentials — Batch B2 = FIX-007 + FIX-010 + FIX-011)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-12-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). It modifies source + tests only (one new cron/job + two small domain-event consumer blocks). No TypeSpec change, no migration, no generator regen. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch other modules, do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Documents & Credentials, Batch B2 (FIX-007 license-renewal cron + FIX-010 certificate-availability notification gate + FIX-011 `verification.requested` audit consumer)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

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

- **`04` Communications (+ feed) Batch B (FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05), 2026-06-12** — COMPLETE. **FIX-007** org-scoped the 4 announcement mutation handlers (`publish/update/delete/archiveAnnouncement` now fetch+write via `repo.get(id, orgId)` → cross-org mutation = 404). **DEC-COMMS-05** added a self-or-officer guard to `listPersonSubscriptions` (`personId === user.id` else `requireOfficerTerm`; cross-member read = 403, no data fetched). **FIX-008** added a `leftJoin` of `announcement_stats` to `CommunicationsRepository.list` so the analytics dashboard shows real counts (proven with a real-Postgres tx-rollback test). **FIX-006** re-roled 15 management ops `#["admin","coordinator"]` → `#["association:officer"]` in `communication.tsp` + regen; the regen was **verified confined** to `routes.ts` (15 gate swaps) + `openapi.json` (15 extensions/descriptions) — validators/registry/types/SDK untouched. Full `bun test` = 6093 pass / 1 fail (pre-existing `registerEmailJobs`) / 4 todo; typecheck 0 errors (5/5). See `docs/aha/module-fix-plans/communications-fix-report.md` § "Batch B — FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05". NOTE: a server restart is needed before the new officer route gate takes effect in a running API (no hot-reload for changed registrations).
- **`04` Documents & Credentials Batch B1 (FIX-003 + FIX-004 + FIX-009), prior pass** — COMPLETE. Access-log rows now persist on view/download (FIX-003, replaced a fake-green AC-M11-005 test); `searchDocuments` enforces published-only for non-officers + wires the ignored `tag` param (FIX-004, with an isolated `documents.tsp` `status`-param add + regen); new `downloadDocument` unit suite (FIX-009). Documents suite 214→230 pass. **Batch B2 (FIX-007/010/011) was explicitly deferred — THIS PASS.** See `docs/aha/module-fix-plans/documents-credentials-fix-report.md`.

## This pass — execute `04` for Documents & Credentials, Batch B2

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` (§3 Active Scope FIX-007/010/011, §4 Batch B2, §5 Test-First rows FIX-007/010/011, §7 shared deps, §8 decisions).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/documents-credentials-gap-plan.md`
   - Prior fix report (what's already done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/documents-credentials-fix-report.md` (Batch B1 complete).
   - Module slug = `documents-credentials`. Readable name = "Documents & Credentials".
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected subset — decision-free:**
   - **FIX-007 — License-renewal-alert cron (P1, G7).** `license_renewal_alerts` is only ever written by `seed/layer-5-gap-fill.ts`; there is no cron/job, so the "nudge before license expiry" credential feature silently does nothing in production. The read/ack handlers already exist (`listLicenseRenewalAlerts.ts`, `acknowledgeLicenseRenewalAlert.ts`) and `LicenseRenewalAlertRepository` lives in `association:member/repos/credits.repo.ts`; only the **producer** is missing. Fix: add a daily license-expiry cron in `association:member/jobs/index.ts` that scans professional licenses expiring within the alert window and inserts idempotent renewal-alert rows — **mirror the existing `dues.reminderProcessor` job pattern** (read it first). RED-first: a license expiring in N days → an alert row is inserted; re-running the cron is idempotent (no duplicates). **Decision-free** — Q7 (whether the alert gets a UI surface) only affects presentation; the cron + alert generation are unblocked. Additive job; keep the jobs-registry edit minimal.
   - **FIX-010 — Certificate-availability notification gate (P2, V1 RECOMMENDED, G12).** The `training.completed` consumer notifies the member "certificate … available to download" even when **no** certificate was issued (issuance is manual officer-initiated bulk-issue). Fix: gate that notification on certificate existence in `core/domain-event-consumers.ts` (the `training.completed` block, ~lines 1101-1140) — no cert → do not send the "available to download" message (send nothing, or a non-misleading message). RED-first: `training.completed` with NO issued certificate → no "available to download" notification. **Decision-free** — Q5 (auto-issue vs officer-initiated) scopes the broader pipeline but the gate/reword is correct and safe regardless; default to officer-initiated, do NOT build an issuance pipeline.
   - **FIX-011 — `verification.requested` audit consumer (P2, V1 RECOMMENDED, G13).** `verification.requested` is already emitted (`member/certificates/verifyCertificatePublic.ts:28`) but has **zero consumers**, so certificate verifications go unlogged — asymmetric with `credential_verification_log`. Fix: add a `verification.requested` consumer in `core/domain-event-consumers.ts` that writes an audit/verification record for certificate verifications (mirror the existing credential-verification logging path / the established consumer pattern). RED-first: a public certificate verification drives the consumer to write a verification/audit record. **Decision-free** — the event already exists; this is add-the-consumer (this is FIX-011 only; do NOT also do FIX-013's emit-vs-amend credential-event work).
5. **Do NOT** implement in this pass (out of subset / later batches):
   - **FIX-003 / FIX-004 / FIX-009** — already DONE (Batch B1). Do not redo.
   - **FIX-001 / FIX-002 / FIX-012 / FIX-014** (Batch A — verification chain) — **Excluded** (`[NEEDS PRODUCT DECISION]` Q1: canonical card-verify token/URL format).
   - **FIX-005 / FIX-006 / FIX-015** (Batch C — certificates PDF + training linkage) — **Excluded** (`[NEEDS CONFIRMATION]` Q8 backfill + Batch F migration + m09 cross-module seam).
   - **FIX-008** (Batch D — credentials per-handler unit suites) — **Excluded** (separate test-hardening prerequisite; required before any credentials *handler* change, but B2 touches no credentials handler).
   - **FIX-013** (`credential.issued`/`credential.revoked` emit-vs-amend) — **Excluded** (`[NEEDS PRODUCT DECISION]`, emit-vs-amend choice).
   - Everything in fix-ready §10 (Deferred — API-key verification, credential-template designer UI, storage virus scan, storage domain events, stale-row reaper, SVG sanitization Q4, orphan-file scrub) and §11 (Do Not Build — persisted `MemberCard`, relocating credentials schema, wiring `listCertificates.ts` as a route, offline-scanner app). G17 doc-sync (P3) → route to the platform doc-drift batch, not here.
6. TDD: write the failing test FIRST for each fix (watch it fail for the right reason — FIX-007: cron produces 0 alert rows / re-run duplicates; FIX-010: "available to download" notification fires with no issued cert; FIX-011: verification of a cert writes no audit record), implement the smallest correct fix, re-run. Do not weaken assertions or fake-green. For FIX-007 mirror the `dues.reminderProcessor` job test pattern; for FIX-010/FIX-011 extend `core/domain-event-consumers.test.ts`.
7. **Shared-file discipline (Batch E):** FIX-010 and FIX-011 both edit `core/domain-event-consumers.ts` — a single file shared by 9 module owners. Make ONE small, separately-tested consumer block per fix; do NOT refactor unrelated consumers, do NOT bundle other shared edits. FIX-007 edits the jobs registry (`association:member/jobs/index.ts`) additively only. NO TypeSpec change, NO migration, NO generator regen this pass.
8. Validate: focused tests per fix → affected dirs (`bun test src/handlers/member src/core/domain-event-consumers.test.ts`) → full `bun test` (api-ts) → `bun run --filter '*' typecheck`. Save the fix report (APPEND a "Batch B2 — FIX-007 + FIX-010 + FIX-011" section to `documents-credentials-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- A2. Elections Batch B (FIX-003 + FIX-005) — ✅ DONE (2026-06-12).
- A3. Auth/RBAC Batch E (FIX-010 INVITE_TOKEN_SECRET) + Batch B cleanup — ✅ DONE (2026-06-12, PARTIAL: `officerAuthMiddleware` deletion deferred — see carry-forward).
- A4. Billing (Stripe) Batch B remainder (FIX-007 updateInvoice txn, FIX-008 unpaid-void) — ✅ DONE (2026-06-12).
- A5. Communications Batch B (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + DEC-COMMS-05 scoping) — ✅ DONE (2026-06-12).
- **A6. Documents Batch B2 (FIX-007 cron, FIX-010 notif gate, FIX-011 audit consumer) — THIS PASS.**
- A7. Notifications Batch C subset (FIX-007 suppression DELETE, FIX-010 queue-lifecycle hurl, FIX-012 orgId guard).
- A8. Person Batch C decision-free subset (FIX-007…014; exclude Q-1/Q-4).
- A9. Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06).
- A10. Platform-admin Batch B decision-free subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11. Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12. Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13. Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose end (small, decision-free-ish eng-confirm — slot anytime):**
- **Auth/RBAC `officerAuthMiddleware` dead-triplet.** Decide whether `src/tests/route-protection-handwired.test.ts` (198 LOC; mounts `officerAuthMiddleware` in mock apps to document a never-adopted wiring — real protection is now covered by `route-registry-rbac.test.ts` + inline `requireOfficerTerm` tests) is obsolete. If yes → delete `middleware/officer-auth.ts` + `officer-auth.test.ts` + `route-protection-handwired.test.ts` together. If no → keep them and amend `ROLE_PERMISSION_MATRIX.md`. Eng-confirm (consider a `/codex` second opinion), NOT a product decision. Full context in `auth-rbac-fix-report.md` § "Batch E + Batch B cleanup" → "Still open".

**Track B — decision-gated (the bottleneck):**
- B1. **Resolve the 3 P0 product decisions:** elections **G2 position-identity** → documents **Q1 card-verify token** → realtime **PD-1 channel-membership model**. Then headline P1s (training TC-DEC-01/02, person Q-4+Q-1, documents Q8, notifs Q3) **plus the auth-rbac gated set: FIX-008 analyst bypass + G3 session-role model + impersonation/403-logging**, and **billing Batch E** (capture-method behavior). Full ranked agenda in roadmap §13.
- B2. Per-module gated `04` passes once unblocked (documents Batch A behind Q1; documents Batch C behind Q8 + Batch F migration; jobs needs jobs-D1 eng-confirm; surveys needs PD-1/2/3).

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Communications A5, 2026-06-12)

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **FIX-007 is an additive cron/job; FIX-010/011 are domain-event consumer logic — none need a NEW migration, TypeSpec change, or generator regen.** Query DB via `bun -e` (or a guarded DB-integration test) against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase` (bun auto-loads `services/api-ts/.env`).
- Known-good baselines (current, AFTER Communications A5): full `bun test` (api-ts) = **6093 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors** (5/5 workspaces). After this pass, expect: +N for the new FIX-007 cron + FIX-010/011 consumer tests; full count rises, no regression.
- `check:sdk-compat` exits 1 **by design** — the frozen baseline `docs/quality/SDK_BASELINE_OPS.json` reflects prior pending TypeSpec work (e.g. governance `closeElectionVoting`) and the Communications FIX-006 regen. Do **NOT** `--update` it until milestone Step 6. **Batch B2 adds 0 operationIds** (no TypeSpec change), so it should not move the SDK surface at all.

## Tree / commit rules

- NOTHING committed; working tree dirty (~250+ files across all prior AHA passes + Communications B2: 5 comms handlers/repo + several comms test files + the comms TypeSpec re-role + its intended generated regen). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass is source + test ADDs/edits only (one new cron + two consumer blocks) — no file deletes, no regen. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Documents & Credentials Batch B2 (FIX-007 + FIX-010 + FIX-011) (decision-free subset). Do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
