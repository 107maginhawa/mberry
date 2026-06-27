# Wave B / B4 — Member events tile (upcoming events + free RSVP)

**Date:** 2026-06-28 · **App:** apps/member · **Version:** v0.1.12.0
**Engine status:** FROZEN (zero changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`)

## Goal

Add the missing 4th member dashboard tile (locked PRD): **upcoming events + RSVP**.
A member sees upcoming events in their chapter, RSVPs to **free** events with one
tap, and sees the fee on paid events. Paid checkout is **deferred** (legacy Stripe
rail + G2-gated). Pure-FE over frozen handlers.

## What exists (recon, verified vs handler source)

- **Discovery:** `GET /public/events` → `listPublicEvents` (PUBLIC, no auth). Returns events with
  `visibility='network'` AND `status IN ('published','completed')`, **across all orgs**. Response
  `{ data: Event[], pagination: { total, limit, offset } }` with a responseTransformer that maps
  `data.data` → parses dates to `Date` and `registrationFee`/`earlyBirdFee` to **`bigint`**. SDK fn
  `listPublicEvents`; query params `limit, offset, eventType, dateFrom, dateTo, pricing, q`. The member
  app filters **client-side** by `organizationId === orgId` + upcoming (`startDate >= now`).
- **Free RSVP:** `POST /association/event-lifecycle/{eventId}/register` → `registerForCustomEvent`. Auth:
  session + **active membership**. **Empty body** (eventId is the path param). Returns `EventRegistration`
  (201, `status` = confirmed | waitlisted when capacity full). `409` if already registered; `200` for an
  idempotent waitlisted re-register. responseTransformer is single-object (dates + amountPaid bigint) —
  **no `.map` crash risk**. SDK fn `registerForCustomEvent`.
- **Paid (DEFERRED):** `POST /association/event-lifecycle/{eventId}/register-and-pay` →
  `registerAndPayForEvent` (enforces `registrationFee > 0`; returns `{ data: { checkoutUrl, registrationId } }`
  with **NO transformer** → envelope drift; runs the **legacy Stripe** connected-account rail, NOT slice-1
  PayMongo). Not wired this slice.
- **Event object** (response): `title, startDate(Date), endDate(Date), location?, capacity?, registeredCount,
  registrationFee?(bigint), currency?, status, eventSlug?, organizationId, eventType`. Spots left =
  `capacity - registeredCount` (capacity undefined ⇒ unlimited).
- `centavosToPhp(amount: number)` in `@monobase/ui` → `Number(registrationFee)` at display.

## Coherence gap (flagged, not a B4 bug)

B3's `createEvent` produces events with `status: 'draft'` and the **default visibility** (the B3 form does
not set `visibility`). `listPublicEvents` only returns `visibility='network'` + published/completed. So
**events created in B3 will NOT appear in this member tile until they are published and made network-visible.**
There is no officer "publish event / set network visibility" UI yet (an `updateEvent` handler exists; a
publish-event flow was not built — parallel to B3's announcement publish being a separate endpoint). B4 is
correct against the discovery contract; the officer→member event handoff is a deferred follow-up. Carry to
the Wave C / backlog notes. B4 still works against any seeded/network events and is the right member surface.

## Approach (chosen, ponytail)

A single **EventsTile** on the dashboard (mirrors MembershipTile/DuesOwedTile/ReceiptsTile). Lists up to ~5
upcoming org events; each row shows title, date, location, fee (or "Free"), and spots-left. Free events get a
one-tap **RSVP** button; paid events show the fee + a "Paid registration coming soon" note (no Stripe wiring).

## Components

```
apps/member/src/
  features/events/
    use-member-events.ts     NEW — useQuery listPublicEvents; client-filter org + upcoming; sort asc; take 5
    use-rsvp.ts              NEW — useMutation registerForCustomEvent({ path:{ eventId } }); 409/waitlist aware
    EventsTile.tsx           NEW — list rows + RSVP / paid-note; loading/error/empty states
  routes/dashboard.tsx       EDIT — add <EventsTile/> after ReceiptsTile
  e2e/events-tile.spec.ts    NEW — dashboard shows the events tile (self-skip if unauthed)
```

- **use-member-events.ts**: `useQuery(['member-events', orgId], { enabled: !!orgId, retry: false })` →
  `listPublicEvents({ query: { limit: 50 } })`; from `data.data` keep `e.organizationId === orgId` AND
  `new Date(e.startDate) >= now` AND `status !== 'cancelled'`, sort by startDate asc, slice(0,5). Read no
  pagination fields (drift). Return the typed `Event[]`.
- **use-rsvp.ts**: `useMutation` calling `registerForCustomEvent({ path: { eventId } })` (empty body). On
  success invalidate `['member-events', orgId]` (registeredCount changes). Map the result `status`
  (confirmed → "You're registered", waitlisted → "Added to the waitlist"). 409 → friendly "You're already
  registered". Read `serverError(error)` for other failures.
- **EventsTile.tsx**: per event row — title, `startDate` formatted (`toLocaleString('en-PH')`), location,
  fee = `registrationFee && Number(registrationFee) > 0 ? centavosToPhp(Number(registrationFee)) : 'Free'`,
  spots-left when capacity set. Free → `<Button>RSVP</Button>` (disabled while pending / after registered);
  paid → muted note "Paid registration coming soon". Loading→Skeleton, error→ErrorState, empty→EmptyState
  ("No upcoming events").

## Money / drift / a11y

- `registrationFee` is **bigint** in the response (transformer) → `Number()` before `centavosToPhp`. Never render
  a raw bigint. Guard `0`/undefined → "Free".
- Drift: bind the list mock to the real handler shape (`{ data: Event[], pagination }`) via `ok<...>()`; only
  read `data.data`. RSVP result read for `status` only. No response-transformer crash on consumed paths.
- a11y (DESIGN.md): 18px base, ≥48px tap RSVP buttons, each event a labeled region, fee/status as text (not
  color-only), RSVP button has an accessible name incl. the event title (e.g. `aria-label="RSVP to {title}"`),
  toast feedback via `sonner`.

## Error / edge cases

- orgId null (no membership) → query disabled → EmptyState.
- No upcoming network events for the org → EmptyState "No upcoming events".
- RSVP 409 (already registered) → friendly toast, button shows "Registered".
- RSVP capacity full → 201 waitlisted → toast "Added to the waitlist".
- RSVP non-membership/403 → friendly error toast (shouldn't happen for an authed member, but handle).
- Paid event → no RSVP call; show fee + deferred note.

## Testing (anti-false-green)

- **use-member-events.test.ts**: `vi.mock` `listPublicEvents`; feed a `{ data: Event[] }` fixture mixing orgs,
  past/future dates, cancelled; assert filter (org + upcoming + not-cancelled), sort asc, cap 5, disabled when
  orgId null. registrationFee as bigint in the fixture.
- **use-rsvp.test.ts**: `vi.mock` `registerForCustomEvent`; assert path `{ eventId }` + empty body; confirmed
  vs waitlisted status mapping; 409 → friendly message.
- **EventsTile.test.tsx**: render with fixture — free event shows RSVP button, paid event shows fee +
  "coming soon" note (no RSVP), spots-left, loading/error/empty states, `not.toMatch(/NaN|undefined|\d+n/)`
  (no raw bigint leak).
- **Typecheck includes tests** (`tsconfig.test.json`). e2e `events-tile.spec.ts`: dashboard shows the tile;
  self-skip if redirected to sign-in.

## Out of scope (flagged)

- Paid event checkout (Stripe rail + G2) — deferred; UI shows fee + "coming soon".
- Officer publish-event / network-visibility UI (the B3→B4 handoff) — deferred follow-up.
- Event detail page, calendar, cancellation/un-RSVP, reminders.

## Engine FROZEN invariant

`git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be EMPTY at PR time.
