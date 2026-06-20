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

## #1 — Activity-worth columns to float8 (cheap, finishes the story)

`events.schema.ts:83`, `training.schema.ts:80/130` = `integer('credit_amount')` while their TypeSpec is already float64 → a 1.5-credit course truncates to 1. Migration 0076 (no matview dep) + 2 schema lines (`integer`→`doublePrecision`); specs already float64, regen only flips event/training validators if any were int (verify). Live: officer creates 1.5-credit training → member earns 1.5. *(detailed after #2)*

## B — Cosmetics (low)

- CountUp force-`.0` consistency in credit tables.
- `completion-table.tsx` "Credits Awarded" hardcoded `0` (pre-existing).
- credit-breakdown deficit / dashboard fallback unrounded text. *(batch after #1)*
