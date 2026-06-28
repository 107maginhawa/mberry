# apps/org — Publish-event UI

Date: 2026-06-28 · Branch: `feat/org-publish-event` · Target: v0.1.19.0

## The gap

Officer-created events are born `draft` and stay invisible to members (member
`EventsTile` filters `status === 'published'`). There is no events **list** and no
**publish** action anywhere in `apps/org` — `routes/events.tsx` renders only
`CreateEventForm`. So a created event can never reach members. This slice adds the
list + publish action that closes the loop.

Engine `services/api-ts` is FROZEN — pure new `apps/org` UI over existing endpoints.

## Engine facts (verified, frozen)

- **Publish:** `publishEvent({ path: { eventId } })` → POST `/association/events/{eventId}/publish`, **no body**, 200 → full `Event`. Engine guards: only `status === 'draft'` publishes (else `BusinessLogicError INVALID_STATUS`). Sets `status='published'`, `publishedAt=now`.
- **List (officer):** `searchEvents({ query: { organizationId, pageSize?, status? } })` → `{ data: Event[], pagination }`. Returns **all** statuses incl. drafts. Has a response transformer (bigint `registrationFee`, Date fields).
- **Event status (DB enum):** `draft | published | cancelled | completed`. (SDK `EventStatus` type carries extra values `registration_open` etc — drift; treat only the 4 real ones, fall through to muted for anything else.)
- `Event` fields used: `id`, `title`, `status`, `startDate` (Date), `registrationFee?` (bigint).

## Interaction

`routes/events.tsx` shows **the list first** (the recurring task), then create below.
DESIGN.md "one primary task per screen": the list is the return task; creation is
occasional. Strong section headings separate them.

- **EventsList** — one row per event: title + human date + `StatusBadge` + a
  **Publish** button **only on `draft`** rows.
- **Publish** → `ConfirmDialog` ("Publish *{title}*? Members will see this event and
  can register. You can't unpublish it here.") → `publishEvent` → on success
  invalidate the list query (badge flips to Published, row stays, button drops) +
  `toast.success`.
- States: loading spinner (`role=status`), error `role=alert` (e.g. 403 not an
  officer), empty state ("No events yet — create one below.").
- After `CreateEventForm` creates a draft, the list refetches → the new draft
  appears, immediately publishable. Mechanism: `CreateEventForm` gains an
  additive optional `onCreated?: () => void` prop (called in its existing
  `onSuccess`); `events.tsx` passes `() => queryClient.invalidateQueries({
  queryKey: ['org-events', orgId] })`.

### Review fixes folded in (impeccable + design)

- **StatusBadge uses the `variant` API, NOT `status`** — event statuses are not
  membership statuses. Map: `draft`→`muted`, `published`→`success`,
  `cancelled`→`error`, `completed`→`muted`; unknown→`muted` with raw text.
  Labels: Draft / Published / Cancelled / Completed.
- **Per-row Publish** carries `aria-label={`Publish ${title}`}` (list has many).
- **Human dates:** `new Date(startDate).toLocaleString('en-PH', { dateStyle:'medium', timeStyle:'short' })`. Never ISO.
- **List first**, create second, each under its own heading.
- Loading / error / empty all designed, not just the happy list.
- Drafts sorted first (only actionable rows).
- 48px tap targets (`min-h-tap`), tokens only, labeled controls.

## Components

- `features/events/use-org-events.ts` — `useQuery({ queryKey: ['org-events', orgId], enabled: !!orgId })` → `searchEvents({ query: { organizationId: orgId, pageSize: 50 } })` → returns `{ status, events }` where events = `data.data ?? []` mapped to `{ id, title, status, startDate, registrationFee }`. Drafts sorted first. Mirrors `use-roster.ts` status-machine shape (`loading|ready|empty|error`).
- `features/events/use-publish-event.ts` — `useMutation` over `publishEvent({ path: { eventId } })`; `{data,error}` seam like `use-create-event.ts`; on success `queryClient.invalidateQueries(['org-events', orgId])`. Returns `{ publish, publishingId }` (track which row is in-flight to disable its button).
- `features/events/EventsList.tsx` — presentational: heading, states, rows, `StatusBadge` (variant API), Publish button + `ConfirmDialog`. Props: `events`, `status`, `onPublish`, `publishingId`.
- `routes/events.tsx` (changed) — `<EventsList>` (wired to hooks) above `<CreateEventForm onCreated={...}>`, each under a heading; `onCreated` invalidates `['org-events', orgId]` so a new draft appears immediately.
- `features/events/CreateEventForm.tsx` (changed) — additive optional `onCreated?: () => void` prop, invoked inside the existing `onSuccess`. No other change.

## Tests (TDD)

- `use-org-events.test.tsx` — maps `data.data`; drafts-first sort; empty/error machine; bigint `registrationFee` coerced.
- `use-publish-event.test.tsx` — calls `publishEvent({path:{eventId}})`; 200→invalidate+success; non-2xx→error; tracks `publishingId`.
- `EventsList.test.tsx` — Publish button only on draft rows; StatusBadge label per status; Publish opens ConfirmDialog → onPublish only after confirm; loading/error/empty render; date formatted (not ISO).
- `events.test.tsx` (new/extend) — list renders above create form.

## Out of scope (YAGNI)

Edit, cancel, unpublish, registration-count, attendee list, paid-event checkout
(legacy Stripe rail + G2). Add when asked.

## Verify / ship

`bun run typecheck` (all workspaces) + `cd apps/org && bunx vitest run`.
Then `/ship` → third-digit bump → **v0.1.19.0** (repo squash-merges).
