# Wave B / B3 — Org minimal events (officer create event + fee + announcement)

**Date:** 2026-06-28 · **App:** apps/org · **Version:** v0.1.11.0
**Engine status:** FROZEN (zero changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`)

## Goal

Close the unbuilt locked-PRD org-app "minimal events slice": an officer can
**create an event** (with an optional registration fee) and **post an
announcement**. Pure-FE over frozen, already-correct engine handlers.

## What exists (recon, verified vs handler source)

- `POST /association/events` → `createEvent`. Auth: `authMiddleware(['association:admin','association:staff'])`
  + `requirePositionMiddleware(['Society Officer','President'])`. Request validator
  (`EventCreateRequestSchema`, **matches the SDK `EventCreateRequest` type** — both TypeSpec-generated):
  required `title`, `organizationId`, `eventType` (enum: assembly|seminar|social|networking|fundraiser|governance|custom),
  `startDate` (ISO datetime), `creditBearing` (boolean); optional `endDate`, `location`, `capacity` (int≥1),
  `description`, `registrationFee` (**`z.number().int()≥0` — integer centavos, NOT bigint at request seam**),
  `currency` (≤3), `visibility` (internal|network). Returns `Event` (201) with a date-parse responseTransformer.
  ⚠️ handler does `endDate: body.endDate!` → treat endDate as required in the form to avoid passing undefined.
- `POST /communications/announcements/:organizationId` → `createAnnouncement`. Auth:
  `authMiddleware(['association:officer'])` + `requirePositionMiddleware(['President','Secretary'])`.
  Request validator (`AnnouncementCreateRequestSchema`, matches SDK `AnnouncementCreateRequest`): required
  `title` (≤200), `content`; optional `audienceType`, `audienceCategories`, `channelPush`, `channelEmail`,
  `visibility`, `status`, `scheduledAt`. Returns `Announcement` (201).
- **2FA-in-prod (requirePositionMiddleware):** privileged positions = president/treasurer/secretary.
  - Event create needs **Society Officer OR President**. "Society Officer" is NOT privileged → an officer with
    that title can create events without 2FA. President needs 2FA in prod.
  - Announcement needs **President OR Secretary** → BOTH privileged → **2FA required in prod.** Without 2FA the
    officer gets 403. Surface as a friendly `role="alert"` (same class as slice-2c), not a crash.
- SDK fns `createEvent` / `createAnnouncement` exist; their **request types match the handlers** → typed-bind is
  safe (wrong field = compile error). Response drift exists but we only need success/error.

## Scope (minimal, ponytail)

CREATE-ONLY. Two single-task officer forms (DESIGN.md: one primary task per screen):
1. **Create event** form → `POST /association/events`.
2. **Post announcement** form → `POST /communications/announcements/:orgId`.

**Listing is OUT of scope and flagged:** no confirmed officer-facing "list org events" endpoint exists
(`getEvent` is by-id; `listPublicEvents`/`listMyCustomEvents` are public/member-scoped; `listAnnouncements`
returns a flat `{data,total,page,pageSize}` that drifts from its paginated SDK type + has a transformer of
uncertain safety). Building a list would invite the slice-2b transformer-crash rabbit hole. After a successful
create we show a success state with the created title; a proper "manage events" list is deferred.

## Components

```
apps/org/src/
  features/events/
    use-create-event.ts          NEW — useMutation → createEvent (typed body)
    CreateEventForm.tsx          NEW — title/type/start/end/location/capacity/fee/description; PHP→centavos
  features/announcements/
    use-create-announcement.ts   NEW — useMutation → createAnnouncement (typed body)
    CreateAnnouncementForm.tsx   NEW — title/content
  routes/events.tsx              NEW — authed route, renders CreateEventForm
  routes/announcements.tsx       NEW — authed route, renders CreateAnnouncementForm
  routes/index.tsx               EDIT — add "Create event" + "Post announcement" links
  routeTree.gen.ts               regenerated
  e2e/events-flow.spec.ts        NEW — officer create-event happy path (self-skip if not authed/officer)
```

## Data flow & decisions

- **orgId** from `useSelectedOrg()` (`org.selectedOrgId`). Both mutations require it; disable submit when null.
- **use-create-event.ts**: `useMutation` calling `createEvent({ body })` where body is typed `EventCreateRequest`:
  `{ organizationId: orgId, title, eventType, startDate: isoString, endDate: isoString, creditBearing: false,
  ...(fee>0 ? { registrationFee: Math.round(feePhp*100), currency: 'PHP' } : {}),
  ...(capacity ? { capacity } : {}), ...(location ? { location } : {}), ...(description ? { description } : {}) }`.
  No-throw error read (`serverError(error)` idiom). Invalidate nothing (no list). onSuccess → toast + reset.
- **registrationFee is a plain integer (centavos)** at the request seam — `z.number().int()`, NOT bigint. Form
  takes a PHP amount (decimal allowed), convert `Math.round(php*100)`. Reject negative/NaN client-side.
- **startDate/endDate**: native `<input type="datetime-local">` (no date-picker dep), value → `new Date(v).toISOString()`.
  endDate required in the form (handler non-null-asserts it).
- **eventType**: native `<select>` of the 7 enum values.
- **use-create-announcement.ts**: `useMutation` calling `createAnnouncement({ path:{ organizationId: orgId },
  body:{ title, content } })`. (Confirm the SDK's param shape — orgId is a PATH param `:organizationId`.)
- **403 handling**: both forms surface the engine's 403 (`Officer access required` / `Two-factor authentication
  required`) as a friendly `role="alert"` banner. Announcement form additionally shows an up-front note:
  "Posting announcements requires a President or Secretary with two-factor authentication enabled."
- **toasts**: `sonner` (success: "Event created" / "Announcement posted").

## Money / drift / a11y

- Money: fee entered in PHP, sent as integer centavos. Display the entered amount with `centavosToPhp` only for
  a confirmation echo (optional). No bigint at this seam.
- Drift: bind request bodies to the typed `EventCreateRequest` / `AnnouncementCreateRequest` (they match the
  handlers — typed-bind is the tripwire). Do NOT consume drifting response fields; we only read 201 success +
  error. No responseTransformer crash risk on the consumed paths (we don't read the response body shape beyond
  presence/`.id`).
- a11y (DESIGN.md): 18px base, ≥48px tap targets, all inputs labeled (`<label htmlFor>`), required marked,
  errors via `role="alert"`, native selects/date inputs (keyboard-accessible), one primary task per route,
  submit button shows pending state + is disabled while submitting or when orgId null.

## Error / edge cases

- No session → routes guarded by `__root` → redirect to `/sign-in`. ✓ existing.
- orgId null → submit disabled + helper text "Select an organization first".
- 403 (not an officer / wrong position / no 2FA) → friendly alert, form stays filled (no data loss).
- 400 (validation, e.g. endDate before startDate) → engine message in alert. Client-side: require endDate ≥ startDate.
- Negative/empty/NaN fee → client-side reject before submit (omit registrationFee when blank).

## Testing (anti-false-green)

- **use-create-event.test.ts**: `vi.mock` the generated `createEvent`; assert the hook sends a typed body with
  `registrationFee` as integer centavos (PHP 250 → 25000), omits fee when blank, `creditBearing:false`,
  ISO dates; maps 403 `error` to a thrown message. Bind the mock with `ok<...>()`/`err()`.
- **CreateEventForm.test.tsx**: renders labeled fields; submit disabled when orgId null; client-side endDate<startDate
  rejected; 403 → `role="alert"` shown; success → toast (mock sonner). `not.toMatch(/NaN|undefined/)`.
- **use-create-announcement.test.ts** + **CreateAnnouncementForm.test.tsx**: typed body `{title,content}` with
  path orgId; 403 → friendly alert incl. the 2FA note.
- **Typecheck includes test files** (`tsconfig.test.json` present); wrong field on the typed body = compile error.
- **e2e events-flow.spec.ts**: officer fills + submits the event form against a running stack; assert success
  toast/text. Self-skip if redirected to sign-in or 403 (no seeded officer/2FA). Spec must exist; controller runs it.

## Out of scope (flagged, not silently cut)

- Event/announcement **list/manage** views (no clean officer list endpoint; listAnnouncements drift).
- Event editing/cancellation (`updateEvent` exists but not in minimal scope).
- CPD/credit-bearing events, early-bird, capacity waitlist UI, cover images, scheduling announcements.
- Member-facing event view + RSVP/pay → that is **B4** (next sub-slice).

## Engine FROZEN invariant

`git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be EMPTY at PR time.
