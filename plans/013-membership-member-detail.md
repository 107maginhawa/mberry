# 013 — Member Detail (Slice 3)

> Slice 3 of the `apps/org` membership-management build.
> Design source of truth: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> §"Screen 2 — MEMBER DETAIL" + Round-2 A3/A7/A8 + Build sequence step 3.
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY.** Recon confirmed every money action is a frozen, wired,
> gated endpoint — the scope-lock "verify record-payment void/edit + renew" is RESOLVED (all exist).
> No TypeSpec / handler / migration / SDK change.

## Goal

Tap a member → see who they are, their standing, their full dues history, and act: send a
pay-link, **record a cash/GCash payment**, **void/refund a mis-entry**, **renew**. The
trust-killer (design A3) is offline payment recording + correction; both land on frozen
endpoints.

## Persona audit (done)

PRESIDENT (Dr. Olive — full access) and SECRETARY/SOCIETY-OFFICER (reduced: timeline yes;
record/refund/summary are TREASURER/PRESIDENT-only → 403). Gaps folded in: graceful role-gate
(friendly notice, summary falls back to the timeline), day-one empty-timeline state, void
eligibility (refund only `completed` + ≤30d), renew confirm step, dues-only timeline (event
payments out, per design).

## Per-action verdict (recon — all FE-only over FROZEN)

| Action | Endpoint | Gating |
|--------|----------|--------|
| Profile read | reuse roster row; `getRosterMember` `GET /association/member/roster/{memberId}` available | admin |
| Standing / outstanding | `listDuesInvoices` (open invoices) — StandingHero logic | admin |
| Payment timeline | `listDuesPayments` `GET /association/member/dues-payments?personId=` | admin (officer sees all) |
| Combined summary (opt) | `getDuesMemberSummary` `GET …/{org}/{personId}` | **TREASURER/PRESIDENT** → 403 fallback |
| Record payment | `recordDuesPayment` `POST /association/member/dues-payments` | **TREASURER/PRESIDENT** |
| Void / refund | `refundDuesPayment` `POST …/{paymentId}/refund` (full=void, partial; `completed` + ≤30d) | **TREASURER/PRESIDENT** |
| Renew | `renewMembership` `POST …/memberships/{membershipId}/renew` (no body) | admin |
| Send pay-link | existing `/members/$membershipId/send` | — |

`paymentMethod` enum: `online | cash | check | bankTransfer | gcash | other`.
`listDuesPayments` row: `receiptNumber, amount (Number via transformer), currency, paymentMethod,
referenceNumber, status (pending|completed|failed|refunded|partiallyRefunded), paidAt,
membershipExtendedTo, refundedAmount`. **Anchor mocks to handler shapes** (drift guard).

## Tasks (vertical, FE-only)

1. **`Timeline` → `packages/ui`** (design says build minimal, reusable for member + event):
   vertical `<ol>` + left border-line; each item = dot + title + meta + optional secondary.
   Tokens only, no router, no domain types.
2. **Route `routes/members/$membershipId/index.tsx`** = `/members/$membershipId` (sibling of
   `/send`). Reads `membershipId` param; profile from route-search (passed from the row:
   personId, name, memberNumber, status, joinedAt, tier) with `getRosterMember` as the
   authoritative refetch fallback when search is absent (deep link).
3. **`MemberDetail` feature**: header (Avatar initials, name, `#memberNumber`, `tier`,
   `StatusBadge`, "Member since {joinedAt}"); standing band (status + outstanding from
   `listDuesInvoices`, `centavosToPhp`); action row (Send pay-link / Record payment / Renew);
   **payment timeline** (`listDuesPayments?personId`, `Timeline`, money via `centavosToPhp`,
   each row gets a Void action when refund-eligible). Skeleton/Empty/Error. Empty timeline =
   calm "No payments recorded yet" + Record/Send CTAs. `getDuesMemberSummary` attempted for the
   richer balance; **on 403 silently fall back** to the timeline (no raw error).
4. **`RecordPaymentDialog`** (`recordDuesPayment`): method dropdown **Cash/GCash/Check/Bank
   transfer/Other** (GCash explicit, NOT under "Online"), amount (pesos→centavos), reference #,
   optional date; **two-step confirm** (DESIGN money-action law: "Step 2 of 2" review of
   amount+method before submit). Toast + timeline refetch. 403 → friendly "Only Treasurer/
   President can record payments."
5. **Void/refund** (`refundDuesPayment`): on a `completed` payment ≤30d, a "Void / refund"
   action → confirm dialog (amount defaults to full = void; optional reason) → submit →
   refetch. Ineligible rows show the action disabled with the reason.
6. **Renew** (`renewMembership`): confirm step ("Extend this member's dues period?") → submit →
   toast + invalidate roster + summary.
7. **Repoint the directory row → detail**: the row tap target becomes `/members/$membershipId`
   (design intent); the per-row "Send pay-link" button is removed (Send now lives in detail).
   This also frees the row's top line so names no longer truncate (Slice-2 minor). Bulk-select
   send-pay-link is unchanged.
8. **Tests:** ui `Timeline` (renders items/empty); hooks (record/refund/renew payload shapes,
   drift-anchored); `RecordPaymentDialog` (method enum incl gcash, centavos conversion, confirm
   step, 403 friendly); `MemberDetail` (header, timeline rows, empty, summary-403 fallback, void
   eligibility); E2E real flow — directory row → detail → record a GCash payment (confirm) →
   appears in timeline → void it → renew. Update `officer-flow` e2e (row → detail → send).

## Scope locks honored

Engine/specs/SDK untouched (all frozen, wired). DESIGN.md: 18px, ≥48px taps, `StatusBadge`,
`centavosToPhp` (no ₱NaN), **confirm step at every money action** (record/void/renew), labeled
method dropdown (GCash explicit), mobile-first, no new abstractions, `packages/ui` only. Drift
guard: anchor mocks to handler shapes + typecheck tests. Real-flow E2E for the money paths.

## Verification (step d)

`bun dev`; sign in (President); directory row → detail; profile + standing + timeline render;
Record a GCash payment with the confirm step → receipt appears in the timeline (money via
`centavosToPhp`, no ₱NaN); Void it → status reflects refund; Renew → confirm → success; a
Secretary sees the timeline but record/refund 403 surfaces friendly; summary-403 falls back.
Gates: ui+org typecheck, full org unit + e2e, build, lint:no-skips/shallow. Engine untouched.
