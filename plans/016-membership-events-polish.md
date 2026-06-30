# 016 — Events Polish (Slice 6)

> Slice 6 of the `apps/org` membership-management build.
> Design source of truth: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> §"Screen 3 — EVENTS" + Round-2 #6 (paid-event honesty) + Build sequence step 6.
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY** — all data already on frozen endpoints. Add-only, no rebuild.

## Goal

Make the events list feel alive and honest: show who's coming, let the officer filter
Upcoming/Past/Drafts, and **warn at the fee field** that paid events need card setup — instead of
a surprise failure at publish.

## Persona audit (done)

Officer managing events. Create → set fee (warn if paid) → list with counts + filter → publish
(free ok; paid blocked at publish but now pre-warned). Gaps: paid-event surprise (the fix);
missing counts; no filter; filter-empty states ("No past events yet").

## Grounded engine facts (FE-only)

- `searchEvents` row (`Event`) **already carries `registeredCount`, `waitlistCount`, `endDate`** —
  counts are free, no N+1. `registrationFee?: bigint` (→ Number). Status enum: draft / published /
  registration_open / registration_closed / in_progress / completed / cancelled. No server status/
  date filter param → filter client-side.
- `use-org-events.ts` currently maps only id/title/status/startDate/registrationFee — **drops
  counts + endDate**; extend `OrgEvent`.
- **Paid-publish block** (`publishEvent.ts`): `registrationFee > 0` AND no active merchant Stripe
  account → `BusinessLogicError('Set up billing before publishing a paid event…', 'STRIPE_NOT_ONBOARDED')`
  (400). Already surfaced by `usePublishEvent` → `toast.error`. The FE fee-field warning is the
  pre-emptive honest notice (unconditional when fee>0 — the lean rail is PayMongo; paid events run
  on Stripe which isn't set up). No Stripe-status query needed.

## Tasks (add-only, FE)

1. **Extend `use-org-events`** `OrgEvent`: add `registeredCount`, `waitlistCount`, `endDate`; map
   from the row. Keep the existing queryKey + drafts-first sort.
2. **`EventsList` counts**: per-row meta line → `{date} · {fee|Free} · {registeredCount} going`
   (+ `· {waitlistCount} waitlist` when >0). `centavosToPhp` for fee.
3. **`EventsList` filter**: chips (`ToggleGroup`: Upcoming / Past / Drafts), client-side:
   Drafts = `status==='draft'`; Past = not-draft AND `endDate < now`; Upcoming = not-draft AND
   `endDate >= now`. Default Upcoming. Per-filter empty state ("No upcoming/past events", "No
   drafts"). Preserve the existing publish action + confirm.
4. **`CreateEventForm` fee warning**: under the fee field, when `fee > 0` show a plain warning —
   "Paid events need card setup, which isn't available yet (PayMongo coming soon). You can save it
   as a draft; publishing a paid event won't work until billing is set up." Non-blocking (they can
   still create a draft).
5. **Tests**: `use-org-events` (maps counts + endDate); `EventsList` (counts render, filter chips
   partition by status/date incl. empty states, publish still works); `CreateEventForm` (fee>0 →
   warning, fee=0/empty → none); extend the events E2E (counts visible, filter switches the list).

## Scope locks honored

Engine/specs/SDK untouched (frozen `searchEvents`/`publishEvent`). DESIGN.md: 18px, ≥48px taps,
`StatusBadge`, `centavosToPhp`, mobile-first, no new abstractions, `packages/ui` only. Drift guard:
bigint fee → Number; mocks anchored to handler/SDK row shape. Add-only — no row rebuild.

## Verification (step d)

`bun dev`; events list shows "N going" per event + fee/Free; Upcoming/Past/Drafts chips partition
correctly with calm empty states; create form warns the moment a fee is entered; publishing a free
event still works; a paid draft still blocks at publish (now pre-warned). Gates: ui+org typecheck,
full org unit + e2e, build, lint:no-skips/shallow. Engine untouched.

## Out of scope (named)

Paid-events-on-PayMongo (the real fix — Slice 7 follow-on), event edit/cancel UI, per-event
revenue, server status/date filters.
