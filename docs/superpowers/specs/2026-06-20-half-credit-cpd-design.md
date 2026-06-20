# Half-Credit CPD — Design & Plan

**Date:** 2026-06-20 · **Branch:** `design/ui-ux-audit` · **Trio:** poll voting ✅ → NPS auto-prompt ✅ → **half-credit CPD (this, last)**
**Status:** DONE + live-verified 2026-06-20. Local on `design/ui-ux-audit` (not pushed). Closes the deferred D3 trio.

## Problem

CPD credits are integer-only. `credit_entry.credit_amount` is a Postgres `integer`, so a member earning **0.5** truncates to 0. TypeSpec `int32` → OpenAPI `integer` → generated Zod `z.number().int()` → a 0.5 submit 400s. The member self-log form double-locks it client-side (`.int()` + `step="1" min="1"`). Goal: 0.5 round-trips end-to-end and **sums correctly** (0.5 + 0.5 = 1.0, never 0 or `"0.50.5"`).

## Verified against source (stale notes CORRECTED)

- ❌ note "int32→**float32**" → every existing fractional credit field in the spec is **float64** (float32 only = NPS scores). **Target = float64.**
- ❌ note "~3 TypeSpec fields" → **11 int32 credit fields** (6 amounts + 5 thresholds) + **13 siblings already float64** → spec internally inconsistent today.
- ❌ note "migration 0074 = the credit migration" → **0074 is the event_type enum fix.** No int→numeric credit migration exists. Need new **0075**.
- ✅ Member self-log is LIVE: FE `my/credits/log.tsx` → `POST /persons/me/credit-entries` → op `createMyCreditEntry` → handler `handlers/person/createMyCreditEntry.ts` (registry.ts:464). (`handlers/member/credits/createCreditEntry.ts` is a dead orphan — unrelated.)
- ✅ Officer credit writes (award/adjust/void) gated President/Secretary/Treasurer via inline `requirePosition` + **2FA in prod** (dev/seed bypass).
- ✅ Matview `compliance_standings` (current def in migration 0070) SUMs `credit_amount` → `ALTER TYPE` is blocked unless dropped/recreated. Matview is hand-managed across 0046/0050/0070 → hand-authored matview SQL in a migration is the established pattern.

## The design fork — column type

| Option | Wire shape | Verdict |
|---|---|---|
| `numeric(p,s)` (note's assumption) | node-postgres returns **STRING** (OID 1700) → OpenAPI says `number` = type-lie (the `dues_fund.percentage` trap). Needs `Number()` at every read + `String()` at every insert; miss one → `'0.5'+'0.5'`. | rejected — most code, most risk |
| **`doublePrecision` (float8)** ✅ | node-postgres returns **JS number** (OID 701). **Zero coercion**. OpenAPI `number` honest. Half/quarter credits are dyadic → 0.5/0.25 exact in IEEE-754; 0.5+0.5=1.0 exact. Matches the 13 already-float64 fields. | **chosen** |
| int half-credits (×2) | exact, int wire — but ÷2 everywhere, breaks float64 fields | rejected — worst churn |

`0.1+0.2≠0.3` cannot bite: domain is 0.5-step. FE guards 0.5 increments (reuse `event-form.tsx` `(val*2)%1===0` refine). Server accepts any decimal ≥0 (`@minValue(0)` preserved) — same posture as existing float64 fields; generated validators aren't hand-editable.

## Scope — core credit_entry ledger (approved)

IN: officer manual award, member self-log, officer adjust → all terminate in `credit_entry`. Plus the earned/sum response fields + member-log FE form.
DEFERRED (documented): training/event/certificate **activity-worth** columns (separate pre-existing latent bug — spec is float64 but DB is `integer`; `award-training-credit.ts:94` truncates. int fits in float8, so leaving them introduces no NEW breakage). Config **thresholds** stay int (whole-number requirements). Member **counts** stay int.

## Plan / Ledger

| # | Task | Where | Status |
|---|---|---|---|
| 1 | TypeSpec: widen 9 credit AMOUNT/SUM fields int32→float64. AMOUNTS: `CreateCreditEntryRequest.creditAmount` (person-custom:109), `MyCreditEntry.creditAmount` (130), `ManualCreditAwardRequest.creditAmount` (training:510), `AdjustCreditRequest.creditAmount` (574), `CreditHistoryEntry.creditAmount` (633). SUMS: `MyCreditSummary.totalCredits` (person-custom:49), `ComplianceRow.earned` (credits:41), `ComplianceRow.remaining` (47), `OfficerRosterMember.creditsEarned` (membership:510). KEEP int32: all `required*` thresholds + counts. | `specs/api/src/...` | ☑ exactly 9 fields, decorators+guards intact (reviewer-confirmed) |
| 2 | DB: schema `credit_amount` integer→`doublePrecision`; `db:generate` → 0075; hand-augment 0075 = `DROP MATERIALIZED VIEW compliance_standings` → ALTER → recreate matview **verbatim from 0070** + unique index | `services/api-ts/src/handlers/association:member/repos/credits.schema.ts`, `.../migrations/0075_wise_shaman.sql` | ☑ matview byte-identical to 0070, no drift; applied clean on API restart |
| 3 | Regen: `specs/api bun run build` → `api-ts bun run generate` → `sdk-ts bun run generate`. Assert generated `ManualCreditAwardRequestSchema.creditAmount` flips `z.number().int()`→`z.number()`. Never hand-edit generated. | — | ☑ all 3 exit 0, validators flipped to `z.number()`, thresholds stay `.int()`, idempotent |
| 4 | Backend audit under float8: confirm insert paths (`createMyCreditEntry`, `awardManualCredit`, `adjustCreditEntry`) insert raw number (correct for float8, NO `String()`); confirm read needs NO `Number()`; keep existing SUM `Number()` wraps (credits.repo.ts:170/210/293) | `services/api-ts/src/handlers/...` | ☑ no coercion needed, no defects, api-ts typecheck exit 0 |
| 5 | FE: `my/credits/log.tsx` — drop Zod `.int()`, add 0.5-increment refine, input `step="0.5" min="0.5"`. (display/sum paths already decimal-safe: CountUp, `Number()` sums) | `apps/memberry/src/routes/_authenticated/my/credits/log.tsx` | ☑ `.int()` gone + 0.5 refine + step/min=0.5; app typecheck exit 0 |
| 6 | Restart API (no watch) + FE typecheck + surveys/credits API tests green | — | ☑ migration applied clean; credit suites 231/0 |
| 7 | Live `/browse`: member logs 0.5 → 201 → shows 0.5; sum round-trips; fractional compliance; 0 console errors | — | ☑ see Result |
| 8 | Commit locally on `design/ui-ux-audit` (not pushed) | — | ☑ |

## Result (verified live 2026-06-20)

- **DB**: `credit_entry.credit_amount` = `double precision`; matview `compliance_standings` recreated; migration 0075 applied on restart ("Database migrations completed successfully", no errors).
- **Member self-log** (member@memberry.ph, live `/browse`): input `step=0.5 min=0.5`; logged `0.5` → `POST /api/persons/me/credit-entries 201`; ledger row renders `0.5` (not 0, not `0.50.5`). Self-logged entries start `pending` (0070 verification gate) — correct.
- **Sum round-trip**: three verified `0.5` entries → member `/my/credits` **Earned 1.5 / Remaining 58.5**; officer compliance report (Maria, President) Miguel row **1.5 … 58.5**; matview `total_credits=1.5`, `compliance_percent=2.5`. 0.5+0.5+0.5 = 1.5 everywhere, never concatenated.
- **Wire shape (anti-trap proof)**: `GET /persons/me/credit-summary` → `totalEarned:1.5, totalCredits:1.5, remaining:58.5` all JSON **numbers**; per-entry `creditAmount:0.5` `typeof === "number"`. float8 ships as number → string-concat impossible (this is why float8 beat `numeric()`).
- **Tests/typecheck**: credit API suites 231/0; api-ts + memberry typecheck exit 0. **0 console errors** throughout.
- Synthetic test entries deleted; dev DB left pristine.

**Deferred (documented):** training/event/certificate **activity-worth** columns stay `integer` (separate pre-existing latent bug — `award-training-credit.ts` truncates a float64 spec into an int column; int fits in float8 so no NEW breakage). Config thresholds + member counts stay int by design.
**Prod note:** officer credit endpoints require 2FA (dev/seed bypass) — same gotcha as D1.

## Verify (DoD)

Live as member@memberry.ph: log a 0.5-credit entry → `201` → ledger shows `0.5` (not 0). As officer test@memberry.ph (Maria, President): manual-award 0.5 → `201`. A member with 0.5 + 0.5 entries shows total `1.0` (not 0, not `"0.50.5"`). Compliance/progress renders fractional earned. FE typecheck clean, credit API tests green, 0 console errors. Prod note: officer endpoints need 2FA (dev bypasses) — flag like D1.
