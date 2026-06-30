# 022 — Unified Member Payment History (Slice 7f)

> Net-new "Later"-tier item (doc: "unified member payment history (dues + event payments)"),
> pulled forward per the user's "do all". Merges dues payments + paid event registrations into one
> chronological timeline on the apps/org member-detail screen.
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: NET-NEW, read-only, FE-ONLY (client-side merge). NO engine change, NO migration,
> NO money movement, NO codegen.**

## Design (client-side merge — leanest, recon-recommended)

No new endpoint. Compose two existing reads in apps/org:
- dues: `listDuesPayments({ personId })` (already wired as `useMemberPayments`).
- events: `searchEventRegistrations({ personId })` → keep rows with `paidAt != null` (settled = a
  real payment). Each row carries `eventId` + `paidAt` but NO amount/title, so fetch event details
  per unique paid `eventId` via `getEvent` (react-query `useQueries`, cached, parallel). Amount =
  `event.registrationFee` (there is no `amount_paid` column — established in 7c/7d).

Merge into one sorted-desc timeline. Dues rows keep the existing void/refund action; event rows are
read-only (event refunds are legacy Stripe, out of scope). A failed/empty events fetch must NOT
break the dues history (independent query, graceful fallback).

Why client-side: a server merge endpoint would be net-new engine on a frozen engine for a
"Later"-tier CRM view; the two list endpoints already exist and a member has few paid events, so
the getEvent fan-out is cheap. Ponytail: no endpoint, no codegen, no migration.

## FE plan (apps/org/src/features/member-detail)

- `use-member-detail.ts`: add `useMemberEventPayments(personId)` → registrations (paidAt set) joined
  to event details → `EventPayment[] { id, eventTitle, amount(centavos), currency, paidAt }`.
  Coerce amount via `Number()` (bigint seam). Drift-anchor to the handler row shapes, not SDK types.
- `MemberDetail.tsx`: merge dues `MemberPayment[]` + `EventPayment[]` into one `Timeline` sorted by
  date desc; dues → existing `PaymentRow` (void), event → new read-only `EventPaymentRow`
  (`centavosToPhp`, event title, "Event" tag). Empty state only when BOTH are empty.

## Tests

FE unit: `useMemberEventPayments` filters unpaid-out, joins event title/fee, coerces amount;
MemberDetail renders a merged sorted timeline (dues + event interleaved), event rows have no void,
empty only when both empty. E2E: member-detail shows a dues payment AND a paid-event line in order.

## Out of scope (named)

Server-side merge endpoint; event refund/void from this screen; pagination of the merged list
(both capped at 50 — surface if exceeded); event payment receipts (no receipt # on registrations).

## Verification

`apps/org` member detail shows dues + paid-event payments in one chronological list; money via
`centavosToPhp`; a member with no event payments is unchanged; events fetch failure degrades to
dues-only. Gates: org vitest + e2e, typecheck, no engine/contract/migration change (FE-only).
