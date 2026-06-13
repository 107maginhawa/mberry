# Continuation prompt — AHA Step 22 (next `04`: Training & Credits — **Batch E subset** decision-free: FIX-014 real E2E proof of the P0 attendance→credit journey + cross-org RBAC test)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-22-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (test-hardening, ONE module, decision-free subset). **Training & Credits, Batch E subset = FIX-014 (the test-only regression/proof batch), narrowed to the two parts that are assertable TODAY without the unshipped Batch B fixes.** Training **Batch A** (FIX-001 attendance→credit wiring, FIX-002 silent-failure surfacing, FIX-003 enrollment-cancel event rescope) is DONE (2026-06-11) but was marked **PARTIALLY COMPLETE** for one honest reason: the P0 journey is proven only at unit+type level — the two existing Playwright specs (`apps/memberry/tests/e2e/officer/training-completion.spec.ts`, `apps/memberry/tests/e2e/member/training-completion-flow.spec.ts`) are **fake-green** (they assert only page render + wire-fired status, never check in a member, never verify a persisted credit). **FIX-014 (this pass)** delivers the missing **real browser proof** of the core platform value: officer marks a named member present → that member earns a persisted **AUTO `CreditEntry`** → it survives a reload. Plus the one decision-free RBAC regression that needs no Batch B: **officer of org A cannot read org B's credit compliance** (resolves the open `[NEEDS CONFIRMATION]` in fix-ready §8 on `getCreditCompliance` ctx-org scoping). Follow the fix-ready plan §3/§5 FIX-014 rows + the Batch-A fix report §9/§15 as the primary guide. **Do NOT expand scope.**
>
> **What FIX-014 EXCLUDES this pass (deferred to land WITH Batch B, on purpose):** the cross-path **cycle-consistency** regression (completion vs manual vs job stamping the same cycle window — FIX-004/G2) and the **void/pending-exclusion** regression across reads + the `compliance_standings` matview (FIX-005/G3). Those presuppose the Batch B fixes, which are **NOT shipped yet** — writing their "correct-behavior" assertions now would be **fake-RED with no GREEN path** (a TDD violation). Author them in the Batch B pass against real behavior. Do NOT start Training **Batch B** (FIX-004/005/006), **Batch C** (FIX-007 `training.type` column + FIX-008 credit-lock, needs migration+regen), **Batch D** (FIX-009 toggle / FIX-010 dup-enroll / FIX-011 `/my/training` predicate / FIX-012 CSV / FIX-013 createTraining org-strip), the `completeCustomTraining` program-complete bulk-award question, paid trainings (G5), fractional credits (F4), or any `[NEEDS PRODUCT DECISION]` item (45-vs-60 default, manual-entry pending policy, self-complete existence). **No DB migration, no schema change, no TypeSpec regen** this pass (FIX-014 is test-only). Stop after saving the fix report.
>
> **FIX-014 approach (prescriptive — read before coding):**
> - **Part 1 — real E2E proof (PRIMARY).** Replace the fake-green `officer/training-completion.spec.ts` body (and strengthen `member/training-completion-flow.spec.ts`) with a **real journey assertion**, not a render check: authenticate as an officer of a seeded org → open the attendance page for a training that has an enrolled member (`/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance`) → check that member in (the UI now sends `personId` — Batch A) → navigate to that **member's** `/my/credits` → assert a persisted **AUTO `CreditEntry`** appears with the **correct member, source/type, and the training's `creditAmount`** → **reload** and assert it persists. **Prove the spec is NOT itself fake-green** with a negative control: a control member who was NOT checked in shows **no** such AUTO credit (or assert the specific credit attributes so a render-only pass cannot satisfy it). This is the RED→GREEN artifact: it would have FAILED before Batch A and must genuinely exercise the journey now. Reserve Playwright strictly for this core journey (AHA `04` §10).
> - **Part 2 — cross-org compliance RBAC (backend, decision-free).** Add/extend a backend test proving an officer whose active term is in **org A** is denied (`403`) when requesting **org B**'s compliance — extend `services/api-ts/src/handlers/member/credits/getCreditCompliance.test.ts` and/or `getComplianceReport.test.ts`. This resolves fix-ready §8's `[NEEDS CONFIRMATION]` ("does `requirePosition` validate the term against the ctx org from the path param?") with a running test, not an assumption. If the test reveals the gate is **missing** (a real cross-org hole rather than a confirmation), STOP at documenting it as a `[NEEDS CONFIRMATION]`→finding in the report and a recommended follow-up fix — do NOT silently add a new tenant guard (that would be a new FIX outside the decision-free test subset; flag it like the dues `updateDuesConfig`/`deleteDuesConfig` cross-org gap was flagged in the dues Batch B report).
>
> **ENV NOTE (verify at start):** Docker stack must be up (postgres + minio + mailpit + stripe-mock); DB migrated (now through `0066_*`) + seeded. **Part 1 (E2E) needs a live stack:** boot API on 7213 (`cd services/api-ts && bun dev`) and memberry on 3004 (`cd apps/memberry && bun dev`), then run the focused spec (`cd apps/memberry && bun run test:e2e officer/training-completion.spec.ts`, or the member spec). **Playwright is pinned to `1.58.2` — DO NOT bump it** (1.59 breaks `test.describe` and will silently skip the suite). **Part 2 (RBAC) needs only `bun test`** (mock ctx via `make-ctx.ts`; no live stack). `[NEEDS CONFIRMATION]` whether the seed layer already provides an officer + an enrolled member + a checkable training in one org — verify against the seed scripts (`services/api-ts/src/.../seed*`/`layer-*`); if no ready enrollment exists, the spec's `beforeAll`/setup must create one via the API/SDK (officer creates training + enrolls the member) rather than asserting against absent data. If the live stack genuinely cannot boot in-env, fall back to a Playwright-against-running-app run the executor boots itself; only as a last resort mark `[BLOCKED BY ENVIRONMENT]` and substitute a component + API-integration proof — but the whole point of FIX-014 is the real browser proof, so exhaust the boot path first.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Training & Credits, Batch E subset (decision-free: FIX-014 — real E2E proof of the P0 attendance→credit journey + cross-org compliance RBAC test)**, using TDD (real failing-first proof, no fake-green). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (training-credits)
03-organize-gap-plan-for-fixing.md     # DONE (training-credits)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS = training-credits Batch E subset / FIX-014)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (re-flag only if schema changes — FIX-014 adds none)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Dues & Payments — Batch B subset — COMPLETE (2026-06-12).** FIX-004 (Treasurer/President `x-require-position` gate on 11 financial dues mutations via TypeSpec + regen, proven by a generated-`routes.ts` assertion), FIX-005 (`validateFundSplits` wired into `upsertDuesFunds`), FIX-006 (`listDuesInvoices` self-scope mirroring PAY-02; added a `personId` filter). Adversarially verified; surfaced a separate `updateDuesConfig`/`deleteDuesConfig` cross-org tenant-guard gap (logged, not fixed — out of subset). See `dues-payments-fix-report.md` §"Batch B subset". Carry-forward: dues settle-seam pass (FIX-007 cap + FIX-010 atomicity) bundled with that config tenant guard.
- **`04` Training & Credits — Batch A — COMPLETE/PARTIALLY-COMPLETE (2026-06-11).** FIX-001 (officer check-in now sends + targets `personId`, completes the enrollee, awards an AUTO credit idempotently; TypeSpec `personId` query added + regen), FIX-002 (extracted `utils/award-training-credit.ts`; bare `catch {}` replaced with logged failure + `creditAwarded: 0`), FIX-003 (new `training.enrollment.cancelled` event + member-only consumer; the gap's "member self-complete corruption" premise was DISPROVEN — those ops are officer-gated). Marked PARTIALLY COMPLETE because the P0 journey lacks a real browser proof (the 2 Playwright specs are fake-green) — **that proof is exactly THIS pass (FIX-014).** **APPEND a "Batch E subset" section to `training-credits-fix-report.md`; do NOT rewrite the Batch A section.**
- **All Track A items A1–A12** (Membership, Elections, Auth/RBAC, Billing, Communications, Documents, Notifications, Person, Marketplace, Jobs, Platform-admin, Realtime Comms Batch B, **Dues Batch B subset**) — DONE.

## This pass — execute `04` for Training & Credits, Batch E subset (FIX-014, decision-free)

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` (§3 FIX-014 row; §4 Batch E; §5 test-first FIX-014 + FIX-001 E2E rows; §6 files; §8 the `requirePosition` ctx-org `[NEEDS CONFIRMATION]`; §13 Batch-A test-first item #1).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/training-credits-gap-plan.md` (§18 Playwright fake-green risk; §20 test gaps; §14 RBAC).
   - Prior fix report (what's done — **APPEND** a "Batch E subset" section; do NOT rewrite Batch A): `docs/aha/module-fix-plans/training-credits-fix-report.md` (§7 item 1 fake-green confirmation; §9 remaining gaps; §15 next step).
   - Module slug = `training-credits`. Readable name = "Training & Credits". Training handlers live under `services/api-ts/src/handlers/association:operations/`; credits under `services/api-ts/src/handlers/member/credits/` + repos in `association:member/repos/`.
3. Invoke `superpowers:test-driven-development`. FIX-014 is test-hardening: the real E2E and the RBAC test are the failing-first/proof artifacts. **Do not weaken assertions; do not assert page-render-only; prove real persisted data and add a negative control so the spec cannot fake-green.**
4. **Selected subset — Batch E decision-free (FIX-014, two parts):**
   - **Part 1 — real E2E proof of the P0 attendance→credit journey (PRIMARY).** Replace `apps/memberry/tests/e2e/officer/training-completion.spec.ts` (and strengthen `apps/memberry/tests/e2e/member/training-completion-flow.spec.ts`) with a real journey: officer logs in → attendance page → checks in a named member → that member's `/my/credits` shows a persisted **AUTO `CreditEntry`** (correct member + source/type + the training's `creditAmount`) → persists across reload. Negative control proves it is not fake-green. Run it against the live stack (API 7213 + memberry 3004), Playwright pinned `1.58.2`.
   - **Part 2 — cross-org compliance RBAC test (backend, decision-free).** Extend `getCreditCompliance.test.ts` / `getComplianceReport.test.ts`: officer of org A → `403` on org B compliance. Resolve the §8 `[NEEDS CONFIRMATION]` with a running test. If it reveals a real missing guard, document it as a finding + recommended follow-up — do NOT add a new tenant guard this pass (out of the test-only subset).
5. **Do NOT implement in this pass (out of subset / gated / later):**
   - FIX-001/002/003 — already DONE (Batch A). Do not redo. Reuse them; the E2E proves them.
   - **FIX-004 cycle-consistency + FIX-005 void/pending-exclusion regression nets** — these are FIX-014 "in spirit" but presuppose the unshipped Batch B fixes; writing their correct-behavior asserts now = fake-RED. **Defer to land WITH Batch B.**
   - **Batch B** (FIX-004/005/006), **Batch C** (FIX-007/008 + migration + regen), **Batch D** (FIX-009..013) — separate `04` passes.
   - `completeCustomTraining` program-complete bulk-award, paid trainings (G5), fractional credits (F4), 45-vs-60 default, manual-entry pending policy, self-complete existence — all `[NEEDS PRODUCT DECISION]`.
   - Everything in fix-ready §10 Deferred / §11 Do-Not-Build. Do NOT relocate credits schema/repo (P1-11 split).
   - **No DB migration, no schema change, no TypeSpec regen.** If a fix appears to need one, STOP and document it — do not expand scope.
6. TDD / test discipline: the real E2E and the RBAC test are written first and must genuinely exercise behavior. The existing specs are already confirmed fake-green (Batch-A report §7 item 1) — replace, do not delete-and-skip. Prove the new E2E catches a regression (negative control / specific-attribute assertion). Do NOT weaken assertions or assert only headings/selectors. Per the test-depth rules: verify REAL persisted data (the credit row), not just that a page rendered; reload to prove persistence.
7. **Pre-flight reads BEFORE touching tests (line numbers may have drifted — re-verify):** `apps/memberry/tests/e2e/officer/training-completion.spec.ts` + `apps/memberry/tests/e2e/member/training-completion-flow.spec.ts` (the fake-green baselines — confirm what they assert); an existing REAL e2e for the auth/login + org-context setup pattern (e.g. another spec under `apps/memberry/tests/e2e/` that logs in and navigates an `/org/$orgSlug/...` route — copy its auth/storageState helper); `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance.tsx` (how check-in sends `personId`); `apps/memberry/src/routes/_authenticated/my/credits/*` (what a credit row renders — pick a stable, data-bearing assertion target); `services/api-ts/src/handlers/association:operations/checkInCustomTraining.ts` + `utils/award-training-credit.ts` (what the awarded credit's source/type/amount are, so the E2E asserts the right values); the seed scripts (`services/api-ts/src/**/seed*` / `layer-*-*.ts`) for a ready officer + member + training/enrollment in one org (else create via API in `beforeAll`); `services/api-ts/src/handlers/member/credits/getCreditCompliance.ts` + `getComplianceReport.ts` + their `.test.ts` (the RBAC ctx-org check + the existing test harness/`stubRepo` pattern); `services/api-ts/src/core/auth/officer-checks.ts` (`requireOfficerTerm`/`requirePosition` ctx-org semantics). The AHA `04` §10 (Playwright only for core journeys) + §6 TDD rules.
8. **No regen workflow this pass.** FIX-014 is test-only — do not run `specs/api` build or `api-ts generate`, do not edit `dues.tsp`/`training.tsp` or any `generated/**`.
9. Validate: run the new real E2E against the booted stack (capture pass + the persisted-credit assertion + the negative control) — save any screenshot/finding under `docs/aha/evidence/`; run the focused RBAC `bun test` (`getCreditCompliance.test.ts` / `getComplianceReport.test.ts`); run the training+credits module suite (`bun test src/handlers/association:operations/ src/handlers/member/credits/` — Batch A baseline was 606 pass); record full api-ts `bun test` vs the current baseline (**~6205 pass / 1 fail / 4 todo**; the 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs`; `getNextBookableTime` is a separate booking clock-boundary-flaky test — do NOT attribute either to this batch); monorepo typecheck (`bun run --filter '*' typecheck`, expect 5/5). `check:sdk-compat` exits 1 by design (frozen baseline) — FIX-014 adds NO operationId, do NOT `--update` it. Save the fix report (APPEND a "Batch E subset — FIX-014" section). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1–A12 — ✅ DONE (through Dues Batch B subset).
- **A13 Training Batch E subset (FIX-014 real E2E proof + cross-org RBAC) — THIS PASS.**
- A14 Training Batch B (FIX-004 cycle authority, FIX-005 void/pending-aware aggregates, FIX-006 one required-credits source) — now has real AUTO credit rows from Batch A to assert against; **land the deferred cycle-consistency + void-exclusion regression nets here**. (Note: FIX-006 value/45-vs-60 default is PD-gated — plumbing is decision-free, the seeded literal is not.)

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Dues settle-seam pass:** FIX-007 (over-refund cap + eligibility) + FIX-010 (proof-atomicity transaction) **+ the `updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard** surfaced in the dues Batch B report — bundle as one tenant-guard/settle-seam pass with membership-status side-effect assertions.
- **Training `completeCustomTraining`** program-complete-without-award path (`[NEEDS PRODUCT DECISION]` bulk-award semantics).
- **Realtime FIX-006** (DM creation UI) — decision-free frontend build; its own comms-UI pass.
- **Jobs Batch B**, **Auth/RBAC `officerAuthMiddleware` dead-triplet**, **Notifications stripe-webhook silent-fail** — as previously queued.
- **3 pre-existing contract failures** (impersonation / governance position-crud / platformadmin) — in those modules' RBAC-gated passes.

**Track B — decision-gated (the bottleneck):**
- B1. P0/P1 product decisions, incl. **training G5 (paid trainings), 45-vs-60 required-credits default, manual-entry pending policy, self-complete/program-complete semantics, fractional credits**, plus dues Q-PD1/2/5/6/7/8, realtime PD-1/2/3, platform-admin Q1–Q4, elections G2, documents Q1, marketplace, person. Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after dues Batch B, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB migrated (through `0066_*`) + seeded. **This pass needs: a LIVE stack for Part 1 (API 7213 + memberry 3004 + Playwright `1.58.2`); `bun test` only for Part 2. No DB migration, no schema change, no regen.**
- Known-good baselines (current): full `bun test` (api-ts) = **~6205 pass / 1 fail / 4 todo** (1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`; `getNextBookableTime` separate clock-flaky). Monorepo `tsc` = **0 errors (5/5)**. Training+credits module suite = **606 pass** from Batch A. Playwright pinned **1.58.2** (DO NOT bump).
- `check:sdk-compat` exits 1 **by design** (frozen baseline). FIX-014 adds no operationId → do NOT `--update` until milestone Step 6.

## Tree / commit rules

- NOTHING committed; working tree dirty (~300+ files across all prior AHA passes incl. dues Batch B + training Batch A). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass ADDS/edits ONLY: the E2E spec files (`apps/memberry/tests/e2e/officer/training-completion.spec.ts` + `member/training-completion-flow.spec.ts`, plus any small e2e helper if one is genuinely needed); the credits RBAC test(s) (`services/api-ts/src/handlers/member/credits/getCreditCompliance.test.ts` and/or `getComplianceReport.test.ts`); optional evidence under `docs/aha/evidence/`; and the fix report. **No source/handler/schema/TypeSpec/`generated/**` changes** (FIX-014 is test-only). Prior-pass dirty files are NOT yours — leave them. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §11 Playwright rules, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY the Training & Credits Batch E decision-free subset (FIX-014 real E2E proof + cross-org RBAC test). Do NOT start Training Batch B/C/D, the deferred cycle/void regression nets, `completeCustomTraining` bulk-award, any PD-gated change, or any other module. Save the fix report and stop.

execute systematically
