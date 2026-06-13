# Continuation prompt — AHA Step 14 (next `04`: Person & Profile — Batch C backend decision-free slice = FIX-007 + FIX-008 + FIX-009 + FIX-012 + FIX-014)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-14-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). It is **backend-only** — source + tests + (FIX-009) one new scheduled job + (FIX-014) two doc edits. **FIX-008 may or may not touch a TypeSpec model** (see below): PREFER aligning the handler to the existing `MyDataExport` model so NO regen is needed; only if the model itself is wrong do you run the generator (and then keep it confined + don't `--update` the SDK baseline). No database migration. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch the frontend (FIX-010/011 are a separate pass), do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Person & Profile (+ deletion cascade), Batch C backend decision-free slice (FIX-007 dead deletion/export event consumers + FIX-008 export shape/certificates/prcId + FIX-009 export-payload purge job + FIX-012 PII-in-log + FIX-014 doc reconciliation)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

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

- **`04` Notifications & Email Batch C subset (FIX-007 suppression DELETE + FIX-010 queue-lifecycle hurl + FIX-012 orgId guard), 2026-06-12** — COMPLETE (A7). FIX-007 added the `deleteEmailSuppression` TypeSpec op + `SuppressionRepository.deleteByIdForOrg` + handler (regen confined, additive SDK op); FIX-010 rewrote `email-extended-flow.hurl` to a real enqueue→cancel(200)→re-cancel(409)→retry(409) lifecycle (validated live); FIX-012 added an `organizationId` guard in `notification.repo.ts` (`ValidationError`, no regression — discovered `handleStripeWebhook.ts` omits orgId but its calls are in swallowing try/catch). See `docs/aha/module-fix-plans/notifications-email-fix-report.md` § "Batch C subset". Full `bun test` = **6110 pass / 1 fail (pre-existing `registerEmailJobs`) / 4 todo**.
- **Person & Profile prior pass — Batch A + B + Batch D RED slice (FIX-001..FIX-006), 2026-06-11** — DONE. FIX-001 (privacy PATCH `orgId` read), FIX-002 (`bio` scrub; `gender` left for Q-4), FIX-003 (consolidated `anonymizePersonFields()`, deleted dead `executeAccountDeletion.ts`), FIX-004 (fail-closed ID-card HMAC), FIX-005 (`updateMyProfile` `phone` map + dead-field removal), FIX-006 (validator-inclusive tests, tightened Hurl §11/§11b). See `docs/aha/module-fix-plans/person-profile-fix-report.md`. **Batch C (FIX-007..FIX-014) was NOT done — THIS PASS does the backend decision-free slice.**

## This pass — execute `04` for Person & Profile, Batch C backend decision-free slice

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/person-profile-fix-ready-plan.md` (§3 rows FIX-007/008/009/012/014, §4 Batch C, §5 Test-First rows, §6 files, §7 deps, §8 decisions, §10/§11 do-not-build).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/person-profile-gap-plan.md`
   - Prior fix report (what's done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/person-profile-fix-report.md` (Batch A/B/D complete; see its §9 Remaining Gaps + §15 for the `person.anonymized` emitterless note).
   - Module slug = `person-profile`. Readable name = "Person & Profile (+ deletion cascade)".
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected subset — decision-free (backend only):**
   - **FIX-007 — wire (or drop) the 4 dead `person.deletion.*` / `data-export.ready` emits (P2, V1 RECOMMENDED, Batch C, G-07).** `person.deletion.requested` / `person.deletion.cancelled` / `person.anonymized` / `data-export.ready` are emitted with ZERO consumers (`requestMyAccountDeletion.ts:99`, `cancelMyAccountDeletion.ts:39`, `requestDataExport.ts:116`; `person.anonymized` is now **emitterless** after Batch C's FIX-003 deleted `executeAccountDeletion.ts` — see prior report §8/§9). Fix: add consumers in `core/domain-event-consumers.ts` reusing the existing 9-subscriber pattern — at minimum notify the person's orgs' active officers on `person.deletion.requested`/`.cancelled` (Spec 10b), and the requester on `data-export.ready`. For `person.anonymized`: either re-emit it from `jobs/deletionProcessor.ts` with a real consumer OR drop the registry entry in `domain-events.registry.ts` (pick the minimal coherent option; do NOT invent new event names/payloads — §11 Do Not Build). RED-first: consumer unit tests in `core/domain-event-consumers.test.ts` (officer notified on request/cancel; export-ready notifies requester). `[SHARED DEPENDENCY]` — additive consumers only.
   - **FIX-008 — align data-export to its own `MyDataExport` model + add certificates/prcId (P2, V1 RECOMMENDED, Batch C, G-08).** `exportMyData.ts:56-91` response shape diverges from the `MyDataExport` TypeSpec model (`person-custom.tsp:52-72`) — missing `payments`/`notifications`/`categories`, no certificates, no `prcId`, key names differ. Fix: reshape the handler to match the existing `MyDataExport` model and include certificates + `prcId`. **PREFER aligning the HANDLER to the existing model (no `.tsp` change, no regen).** Only if the model itself is genuinely wrong do you edit `person-custom.tsp` + run the full regen (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`), keep it confined, and do NOT `--update` the SDK baseline. RED-first: `exportMyData.test.ts` asserts the response matches `MyDataExport` (incl. certificates + prcId).
   - **FIX-009 — export-payload purge job (P2, V1 RECOMMENDED, Batch C, §13).** `data_export.payload` (full PII JSONB) is retained indefinitely after the 7-day download link expires — DPA data-minimization violation; no purge job. Fix: add a new scheduled job in `handlers/person/jobs/` (+ register in `person/jobs/index.ts`) that nulls/removes expired-export payloads past TTL. Mirror `deletionProcessor` job + test style. RED-first: a unit test that an expired-export payload is purged and a fresh one is retained. **No schema change** (purge job only).
   - **FIX-012 — stop logging the raw email (P2, V1 RECOMMENDED, Batch C, G-14).** `createPerson.ts:101` logs `email: body.contactInfo?.email` at info — violates CLAUDE.md no-PII-logs + DPA-05. Fix: log a `hasEmail` boolean instead. RED-first: `createPerson.test.ts` asserts no raw email in the log payload (log-shape assertion). Trivial.
   - **FIX-014 — doc reconciliation (P2/P3, V1 RECOMMENDED doc, Batch C, G-15 doc).** `EVENT_CONTRACTS.md` §0.1-0.3 claims pg-boss at-least-once delivery for domain events, but `core/domain-events.ts` is an in-process `Promise.allSettled` log-only bus; `m02 API_CONTRACTS.md` §2 documents `/my/*` while routes are `/persons/me/*`. Fix: correct both docs to match reality. **Doc-only, no test** (`[SHARED DEPENDENCY]` doc target — correct only the doc; the bus reliability change is core-platform scope, NOT this pass).
5. **Do NOT implement in this pass (out of subset / blocked / later):**
   - **FIX-001 / FIX-002 / FIX-003 / FIX-004 / FIX-005 / FIX-006** — already DONE (Batch A/B/D). Do not redo.
   - **FIX-010 (grace banner) + FIX-011 (id-card org selector)** — frontend + Playwright E2E. **Excluded from this slice** — they need the memberry app + a browser env. Run them as the **next pass (A8b)**.
   - **FIX-013** (`notification_preference` orgId scoping) — **Excluded** (`[NEEDS CONFIRMATION]` Q-7: notification prefs global vs per-org + whether legacy `updatePrivacySettings.ts`/`updateNotificationPreferences.ts` are still routed; has a product dimension). Do it once Q-7 is eng+product confirmed.
   - **`gender` scrub** (Q-4), **G-02** 4 unenforced privacy toggles (Q-1, cross-module directory), **G-06** directory-publish duplicates (cross-module chapters-directory), the **generated-Zod required→optional** generator bug (prompt 05), the **`core/domain-events.ts` reliability** upgrade (core-platform audit) — all excluded.
   - Everything in fix-ready §10 (Deferred) and §11 (Do Not Build): consent fields, websocket privacy propagation, NEW `person.*` events, pg-boss/DLQ bus, admin update-any in the person module, ZIP export, share-link flag, email-change OTP UI, license regex, cascade-scope extension, `subSpecialization`/`yearsOfPractice`/`affiliation` fields, server-side DELETE-confirmation body.
6. TDD: write the failing test FIRST for each fix (watch it fail for the right reason — FIX-007: emits have no consumer so no notification row is created; FIX-008: response shape ≠ `MyDataExport` / missing certs+prcId; FIX-009: expired payload still present after the job; FIX-012: raw email present in the log payload). Implement the smallest correct fix, re-run. Do not weaken assertions or fake-green. Reuse the existing consumer pattern in `domain-event-consumers.ts` for FIX-007 (do not add a new event class).
7. **Shared-file / regen discipline:** FIX-007 edits the shared `core/domain-event-consumers.ts` (+ maybe `domain-events.registry.ts`) — additive consumers only, reuse the pattern, do NOT change event names/payloads or bus semantics. FIX-008 should PREFER no `.tsp` change (align handler to the existing model); **only if you must change `person-custom.tsp`** do you run the generator — then **never hand-edit `generated/**`**, verify the regen is confined to the changed op(s), run `check:sdk-compat` (it will still exit 1 by design — the frozen baseline already carries prior pending ops incl. `deleteEmailSuppression`; any new op you add is expected in the diff; do NOT `--update` the baseline until milestone Step 6). NO database migration this pass.
8. Validate: focused tests per fix → affected dirs (`bun test src/handlers/person src/core/domain-event-consumers.test.ts`) → full `bun test` (api-ts) → `bun run --filter '*' typecheck` → (only if FIX-008 changed `.tsp`) `check:sdk-compat`. Save the fix report (APPEND a "Batch C backend slice — FIX-007 + FIX-008 + FIX-009 + FIX-012 + FIX-014" section to `person-profile-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- A2. Elections Batch B (FIX-003 + FIX-005) — ✅ DONE (2026-06-12).
- A3. Auth/RBAC Batch E + Batch B cleanup — ✅ DONE (2026-06-12, PARTIAL: `officerAuthMiddleware` deletion deferred — see carry-forward).
- A4. Billing (Stripe) Batch B remainder — ✅ DONE (2026-06-12).
- A5. Communications Batch B — ✅ DONE (2026-06-12).
- A6. Documents Batch B2 — ✅ DONE (2026-06-12).
- A7. Notifications Batch C subset (FIX-007/010/012) — ✅ DONE (2026-06-12).
- **A8. Person Batch C — backend decision-free slice (FIX-007/008/009/012/014) — THIS PASS.**
- A8b. Person Batch C — frontend slice (FIX-010 grace banner + FIX-011 id-card org selector) — next; needs memberry app + Playwright.
- A8c. Person FIX-013 (`notification_preference` orgId) — after Q-7 eng+product confirmation.
- A9. Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06).
- A10. Platform-admin Batch B decision-free subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11. Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12. Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13. Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose ends (small, decision-free-ish eng-confirm — slot anytime):**
- **Auth/RBAC `officerAuthMiddleware` dead-triplet.** Decide whether `src/tests/route-protection-handwired.test.ts` (+ `middleware/officer-auth.ts` + `officer-auth.test.ts`) is obsolete; delete together if yes, else amend `ROLE_PERMISSION_MATRIX.md`. Eng-confirm (consider `/codex`). Context in `auth-rbac-fix-report.md`.
- **Notifications stripe-webhook silent-fail.** `handlers/billing/handleStripeWebhook.ts` (5 `createNotification` calls) omits `organizationId` → those payment notifications never fire (pre-existing; the A7 orgId guard makes the failure explicit but does not fix it). Thread orgId into those calls in a billing/notifications pass. `[CROSS-MODULE RISK]`. See `notifications-email-fix-report.md` § "Batch C subset" Remaining Gaps.

**Track B — decision-gated (the bottleneck):**
- B1. **Resolve the 3 P0 product decisions:** elections **G2 position-identity** → documents **Q1 card-verify token** → realtime **PD-1 channel-membership model**. Then headline P1s (training TC-DEC-01/02, person **Q-1 privacy-model** + **Q-4 gender scrub** + **Q-7 pref store/org**, documents Q8, notifs Q3 preference-store owner) plus the auth-rbac gated set + billing Batch E. Full ranked agenda in roadmap §13.
- B2. Per-module gated `04` passes once unblocked (person G-02 behind Q-1, FIX-013 behind Q-7, `gender` behind Q-4; notifs FIX-003 behind Q2, FIX-004/005 behind Q3, FIX-006 behind Q1; documents Batch A behind Q1; jobs jobs-D1; surveys PD-1/2/3).

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Notifications Batch C, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock, all healthy). DB `localhost:5432/monobase` migrated through **0066** + seeded. This slice is **backend, unit-provable** — no live server needed for FIX-007/009/012/014. FIX-008 is contract-shaped but its proof is a backend/unit assertion against the `MyDataExport` model (and an optional person Hurl assertion if you boot an impl). Query the DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase` (bun auto-loads `services/api-ts/.env`). To run any contract/E2E proof you must boot the api server — to avoid disturbing a running :7213, boot a throwaway instance: `cd services/api-ts && SERVER_PORT=7299 bun src/index.ts` (same DB), run against `API_URL=http://localhost:7299`, then kill it (`kill $(lsof -ti tcp:7299)`).
- Known-good baselines (current, AFTER Notifications Batch C): full `bun test` (api-ts) = **6110 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs env 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors** (5/5 workspaces). After this pass, expect: +N for the FIX-007 consumer + FIX-008 export-shape + FIX-009 purge-job + FIX-012 log unit tests; full count rises, no regression.
- `check:sdk-compat` exits 1 **by design** — the frozen baseline `docs/quality/SDK_BASELINE_OPS.json` reflects prior pending TypeSpec work (governance `closeElectionVoting`, Communications FIX-006, **and now `deleteEmailSuppression`** from A7). Do NOT `--update` the baseline until milestone Step 6. This pass should add NO new operationId unless FIX-008 forces a `.tsp` model change (avoid it).

## Tree / commit rules

- NOTHING committed; working tree dirty (~277 files across all prior AHA passes + Notifications Batch C: `email.tsp`, `deleteEmailSuppression.ts`/`.test.ts`, `suppression.repo.ts`, `notification.repo.ts`/`.test.ts`, the two email hurls, the regen, and the fix report). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass is source + test ADDs/edits + one new job + two doc edits (+ optional confined regen only if FIX-008 needs it) — no unrelated file deletes. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Person & Profile Batch C backend decision-free slice (FIX-007 + FIX-008 + FIX-009 + FIX-012 + FIX-014). Do NOT touch the frontend, do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
