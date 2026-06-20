# CPD Follow-ups (post half-credit trio) — Design & Ledger

**Date:** 2026-06-20 · **Branch:** `design/ui-ux-audit` · Follows [[half-credit-cpd]].
**Doing all of A+B from the "what's left" review, in order:** #2 verify-credit → #1 activity-worth float8 → B cosmetics. (C broader backlog = separate: Stripe, MinIO, ship.)

## #2 — Officer credit verification flow (HIGHEST VALUE)

**Problem:** Member self-logged CPD entries default `verification_status='pending'` (0070 gate). Only `awardManualCredit`/`adjustCreditEntry` ever set `verified`. There is **no handler/UI to verify a pending entry** → self-reported CPD never counts toward compliance. The self-log form (just unblocked for 0.5) produces entries stuck in limbo.

**Verified vs source:**
- enum `credit_verification_status` = `['pending','verified','rejected']` (credits.schema.ts:36), col default `pending` (53).
- matview refresh is event-driven: emit `compliance.recompute` → consumer runs `REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings` (domain-event-consumers.ts:1137). award/adjust defer via this event.
- officer compliance report (`getCreditCompliance`) reads the matview (compliance.repo.ts).
- **No** officer pending-credit view exists today.
- **Exact analog** = dues payment-proof flow: `listPendingProofs`/`confirmPaymentProof`/`rejectPaymentProof` + FE `pending-proofs-list.tsx` in `officer/payments/index.tsx`. Authz = inline `requirePosition`. Mirror it.

**Design (mirror dues-proof + credit family):**
- Backend, 3 new ops in `specs/api/src/association/operations/training.tsp` credit section:
  - `listPendingCreditEntries` (GET, officer) — pending+active entries for org, joined to person for name; returns id/personId/memberName/activityName/activityDate/creditAmount (float64)/category/supportingDocumentId/createdAt.
  - `verifyCreditEntry` (POST `/.../{creditEntryId}/verify`, officer) — require entry pending, set `verified`+updatedBy, emit `compliance.recompute`, audit.
  - `rejectCreditEntry` (POST `/.../{creditEntryId}/reject`, officer, optional `{reason}`) — pending→`rejected`, emit `compliance.recompute`, audit.
  - Authz: inline `requirePosition(President/Secretary/Treasurer)` — org derived from the entry at runtime (CLAUDE.md inline carve-out; matches award/adjust/void + confirmPaymentProof).
- Frontend: `apps/memberry/src/features/.../pending-credits-list.tsx` (mirror `pending-proofs-list.tsx`) — table + Approve/Reject (amount rendered decimal-safe). Surface as "Pending Approvals" section atop `officer/reports/credits.tsx`.
- Regen full pipeline; SDK hooks auto-gen (`useListPendingCreditEntries`/`useVerifyCreditEntry`/`useRejectCreditEntry`).

**Ledger #2**

| # | Task | Status |
|---|---|---|
| 2.1 | TypeSpec: 3 ops + 4 models (creditAmount float64, memberName) in training.tsp credit section + main.tsp route mounts | ☑ reviewer-confirmed; ops at /credit-compliance/{org}/pending, /credits/{id}/verify, /credits/{id}/reject |
| 2.2 | Regen stubs (specs build + api-ts generate) | ☑ both exit 0, 3 ops wired in registry/routes/validators |
| 2.3 | Backend handlers (list/verify/reject) mirroring dues-proof + inline requirePosition + emit compliance.recompute + audit + tests | ☑ fix-pass added audit+tests; 18/0 |
| 2.4 | SDK generate + api-ts typecheck | ☑ hooks generated, typecheck exit 0 |
| 2.5 | FE pending-credits-list + wire atop officer Credit Reports + typecheck | ☑ sonner toasts, reason dialog, query invalidation; typecheck 0 |
| 2.6 | Restart API + credit tests green | ☑ 18/0 new + boot clean |
| 2.7 | Live /browse approve + reject | ☑ see Result |
| 2.8 | Commit locally | ☑ |

**Result (verified live 2026-06-20):**
- New endpoint `GET /credit-compliance/{org}/pending` returns pending entries with `memberName` + `creditAmount` as JSON **number** (0.5).
- **Approve loop**: member self-logs 0.5 (pending, Earned 0) → officer Credit Reports shows "Pending Approvals" → click Approve → `POST /credits/{id}/verify 200` → entry `verified`, `compliance.recompute` refreshes matview → **member Earned 0.5 / Remaining 59.5** (live sum) + matview total 0.5.
- **Reject loop**: member logs another 0.5 → officer Reject → reason dialog ("...optional, shown to member") → `POST /credits/{id}/reject 200` → entry `rejected`, **excluded** from sum (matview stays 0.5).
- Double-gated (role middleware `association:admin|staff` + inline `requirePosition` President/Secretary/Treasurer). 0 console errors. New handler tests 18/0; api-ts + memberry typecheck 0. Test entries cleaned.

**Verify (DoD #2):** ✅ all met.

## #1 — Activity-worth columns to float8 (DONE)

`events.schema.ts:83`, `training.schema.ts:80/130` were `integer('credit_amount')` while their TypeSpec + generated validators were already `float64`/`z.number()` → the **DB column was the only blocker** (a 1.5-credit course truncated to 1; `award-training-credit.ts:94` then carried the truncated value into `credit_entry`).

**Shipped:** 3 schema columns `integer`→`doublePrecision` (event, course, training) + `doublePrecision` import. Migration **0076_overjoyed_chamber** = 3 plain ALTERs (no matview dep — only `credit_entry.credit_amount` feeds `compliance_standings`). No TypeSpec/validator/SDK change needed (int and float both `number`; validators already `z.number()`).

**Verified:** after 0076, `event`/`training`/`course`.credit_amount all `double precision`; API list read-back of a training set to `14.5` returns `creditAmount:14.5` `typeof "number"` (no truncation, no string). Officer create-training form already had `step=0.5` and held `1.5`. Award path now carries fractions into `credit_entry` (both float8). Migration applied clean on restart.

| # | Task | Status |
|---|---|---|
| 1.1 | 3 schema cols integer→doublePrecision + import | ☑ |
| 1.2 | Migration 0076 (3 ALTERs, no matview) | ☑ |
| 1.3 | Restart + DB column types double precision | ☑ |
| 1.4 | Live: training holds/serves 14.5 as number | ☑ |
| 1.5 | Commit | ☑ |

## B — Cosmetics (triaged, DONE)

- ☑ **`completion-table.tsx` "Credits Awarded" hardcoded `0`** (pre-existing bug) → FIXED: `completedCount * Number(creditAmount)` (decimal-safe). Verified live: a training with 4 completions × 16 credits now shows **64 Credits Awarded** (was 0).
- ⊘ **CountUp force-`.0`** — WON'T FIX. Current "4" / "4.5" is the correct CPD convention; forcing "60.0" would regress.
- ⊘ **deficit / dashboard fallback text** — NON-ISSUE. `60 − 1.5 = 58.5` renders "58.5 more credits needed"; dyadic half-credits produce no float artifacts, pluralization already guards `!== 1`.
