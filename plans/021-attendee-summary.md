# 021 — Attendee Summary Endpoint (Slice 7e)

> Step-7 follow-on (last engine endpoint). Server-side attendee counts for the door screen,
> replacing the apps/org client-side tally that caps at 100 rows + miscounts no-shows.
> Design: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> Screen 4 gap "Attendee summary counts = net-new GET .../registrations/summary".
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: NET-NEW, read-only, ADDITIVE engine. NO migration, NO money movement.**

## Persona (door officer — already audited in 7c)

Officer at the door wants accurate "38 attending · 35 paid · 3 checked-in" counts. Today the
tally is client-side over the first 100 registrations only (>100 → wrong), and the no-show count
uses `status === 'no_show'` which never matches the real DB value `noShow` (drift). Server-side
counts fix both.

## Engine design (additive, no migration)

New officer-gated read op `getEventRegistrationsSummary`:
- Path: `GET /association/event-lifecycle/{eventId}/registrations/summary` (mirrors
  `listCustomEventRegistrations`, same EventLifecycleService interface + roles).
- Response model `EventRegistrationsSummary { totalAttending, paid, checkedIn, noShow : int32 }`.
- Guards: auth (401), org context (403), event exists + org-owned (404).
- Single aggregate query (no N+1) over `event_registration` LEFT JOIN `check_in`:
  - `totalAttending` = COUNT WHERE status NOT IN ('cancelled','refunded')  (includes noShow +
    confirmed + waitlisted — matches the current FE `active` set).
  - `paid` = same filter AND `paid_at IS NOT NULL`.
  - `checkedIn` = COUNT(DISTINCT registration) with a `check_in` row.
  - `noShow` = COUNT WHERE status = 'noShow'  (**real DB enum value**, not the SDK's `no_show`).
- New repo method `EventRegistrationRepository.summaryByEvent(eventId, orgId)`.

**Drift note (verified):** the registration_status pgEnum stores `noShow`/`cancelled`/`refunded`;
the SDK type claims `no_show`. The SQL uses the real DB values. The response is plain ints — no
status string crosses the wire, so the endpoint is drift-proof.

## FE repoint (apps/org door screen)

- `use-event-detail.ts`: add `useEventSummary(orgId, eventId)` calling the new endpoint; the
  attendee summary line in `EventDetail.tsx` reads from it (falls back to client tally only while
  the summary query is loading/errored, so the screen never regresses).
- Keep the attendee LIST cap at 100 + the truncation banner (the list is still paginated; only the
  COUNTS move server-side and become accurate for >100-attendee events).

## Full chain (plans/000 §b net-new)

`/typespec` (model + op) → `cd specs/api && bun run build` → `cd services/api-ts && bun run
generate` → **RED real-PG integration test first** (`createScratch ['event','event_registration',
'check_in']`: mixed regs → correct counts; cancelled/refunded excluded from total; noShow counted
on the real DB value; check-in counted; cross-org isolation; 404 missing event) → `/handler`
(GREEN) → `/test-api` → regen SDK → `/contract-scaffold`/`/test-contract` (smoke: 200 + <500) →
`/frontend-design` (repoint counts) → FE test + E2E → `/module-review` → review → `/pre-commit` →
`/commit`.

## Out of scope (named)

waitlistCount in the summary; the pre-existing mark-no-show write bug (FE sends `no_show` to a
`noShow` enum — flagged separately, not this slice); offline counts.

## Verification

Engine real-PG suite GREEN incl. new summary tests + unchanged event suite; door screen shows
accurate counts for a >100-attendee event (no truncation of the numbers). Gates: contract,
migration-safety (none), br-coverage, coverage-matrix, lint:no-skips/shallow, SDK git-diff.
