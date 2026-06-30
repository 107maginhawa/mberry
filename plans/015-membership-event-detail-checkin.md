# 015 — Event Detail / Door Check-in (Slice 5)

> Slice 5 of the `apps/org` membership-management build.
> Design source of truth: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> §"Screen 4 — EVENT DETAIL" + Round-2 B (door) + C (graceful POST-failure).
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY** — every endpoint is frozen + wired. No engine/spec/SDK change.

## Goal

Tap an event → run the door: attendee list with paid/RSVP status, one-tap check-in, mark
no-show, a live count summary. Mobile-first, fast, resilient to spotty venue wifi.

## Persona audit (done)

Officer at the door (Society Officer/President; mobile, time-pressured). Journey: open event →
search attendee → see paid + RSVP → check in (one tap) → mark no-show → counts update. Gaps:
graceful check-in POST-failure (retry, pending — never silent loss), paid badge only for paid
events, already-checked-in disables the button, cancelled/refunded rows muted, friendly 403.

## Grounded engine facts (anchor to handler shapes; DRIFT corrections)

- `getEvent` `GET /association/events/{eventId}` → `title, startDate, endDate (Date), location,
  registrationFee (bigint→Number), currency, status, capacity, registeredCount, waitlistCount`.
- `listCustomEventRegistrations` `GET …/{eventId}/registrations` → rows: `id, personId,
  registeredAt (Date), status ('registered'|'waitlisted'|'confirmed'|'checked_in'|'cancelled'|
  'no_show'|'refunded'), amountPaid (bigint→Number), paymentId`. **No `paidAt`** — paid signal =
  `amountPaid > 0 || paymentId != null`. (Person name NOT on the row — see gap below.)
- `searchCheckIns` `GET …/checkins?eventId=` → check-in records `{ personId, registrationId,
  checkedInAt, method }`. Authoritative "who's in."
- `checkInCustomEvent` `POST …/{eventId}/check-in` body `{ personId?, registrationId?, method? }`.
- `updateEventRegistration` `PATCH …/registrations/{registrationId}` body `{ status: 'no_show' }`.
- All officer-gated (Society Officer/President; 2FA in prod) → friendly 403.
- **Gap to verify in build:** does the registration row carry a person name? If not, derive a
  display label (memberNumber/personId short) or cross-ref the roster — confirm the real shape
  first; never invent a name field. Checked-in = `status==='checked_in'` OR a `searchCheckIns`
  record exists.

## Tasks (vertical, FE-only)

1. **`use-event-detail` hooks**: `getEvent` (header); `listCustomEventRegistrations` +
   `searchCheckIns` merged into attendee rows `{ registrationId, personId, label, status,
   paid, checkedIn }` (paid via amountPaid/paymentId; checkedIn via status/check-in set);
   mutations `useCheckIn` (`checkInCustomEvent`) and `useMarkNoShow` (`updateEventRegistration`).
   Money/dates coerced.
2. **`EventDetail` feature**: header (title, date — incl. time, location, fee via `centavosToPhp`
   when paid, `StatusBadge`); **client-side summary** (confirmed · paid · checked-in · no-show);
   search `Input`; attendee rows (label + RSVP `StatusBadge` + **paid badge only when the event
   is paid** + a **Check in** button [disabled when already in] + **No-show**). Skeleton/Empty/
   Error. **Graceful POST-failure**: a failed check-in/no-show shows an inline retry + pending
   state (never silent) — design C.
3. **Route `/events/$eventId`** (resolve the TanStack flat-vs-folder convention without breaking
   the existing `/events` list route).
4. **Repoint the events list** (`EventsList`) row → detail; keep the existing publish action.
5. **Tests**: hooks (merge logic, paid derivation, check-in/no-show payloads, drift-anchored);
   `EventDetail` (rows, paid badge only-when-paid, already-checked-in disabled, summary counts,
   failed-POST retry); E2E door flow — open event → check in an attendee (row flips) → mark a
   no-show → paid badge shows for a paid registrant. Anchor mocks to handler shapes.

## Scope locks honored

Engine/specs/SDK untouched (all frozen + wired). DESIGN.md: 18px, ≥48px taps, `StatusBadge`
text+color, `centavosToPhp`, labeled controls, mobile-first, no new abstractions, `packages/ui`
only. Drift guard: paid = amountPaid/paymentId (NOT paidAt); bigint→Number; mocks to handler
shapes + typecheck tests. PWA online-only (locked) but failed POST handled gracefully (retry).

## Out of scope (named, design)

Door cash collection / walk-up register + `mark-paid` (net-new endpoint → v1.x), attendee
summary endpoint (tally client-side now), QR-scan check-in, paid-events-on-PayMongo. Events
polish (counts/filters/paid-fee warning on the LIST) = Slice 6.

## Verification (step d)

`bun dev`; events list → tap event → detail; attendee list renders with RSVP + paid (paid event)
status; check an attendee in → row flips to checked-in, summary increments; mark a no-show;
force a check-in POST failure → inline retry, not silent loss; free event shows no paid column.
Gates: ui+org typecheck, full org unit + e2e, build, lint:no-skips/shallow. Engine untouched.
