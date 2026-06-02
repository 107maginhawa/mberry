# Cluster B — Training / Credits / Events / Bookings / Surveys (member-facing)

Static read-only UI journey audit. apps/memberry (React + TanStack Router + @monobase/sdk-ts hooks, `sonner` toasts). No execution.

## Scan Manifest

| Metric | Value |
|--------|-------|
| Files inventoried | 37 (21 routes + 16 non-test feature components) |
| Files scanned | 37 (100%) |
| Status | COMPLETE |

Routes scanned (21): my/training, my/credits/index, my/credits/log, org/$orgSlug/my-cpd, org/$orgSlug/training/index, org/$orgSlug/training/$trainingId, my/certificates/index, my/certificates/$certificateId, my/bookings/index, my/bookings/$bookingId, my/bookings/host.$personId, my/bookings/host.$personId.$slotId, my/calendar, my/schedule, my/events, org/$orgSlug/events/index, org/$orgSlug/events/$eventId, events/$eventSlug (public), discover/events (public), my/surveys/index, my/surveys/$surveyId.

Feature components scanned (16): events/{event-card, event-list, event-calendar, event-timeline, post-event-actions, attendance-view, event-form}; training/{training-card, training-list, completion-table, training-form}; certificates/{certificate-list, certificate-preview}; booking/{host-directory, booking-list, booking-event-editor, active-booking-card, booking-widget}; surveys/{survey-list, survey-builder, survey-flow, poll-card, nps-modal, …}.

Note: `events/$eventSlug.tsx` and `discover/events.tsx` are PUBLIC (under `routes/`, not `_authenticated/`) — task brief listed them without that path qualifier. Both present and scanned.

Elements by type (member-relevant): Link/navigate ~28; submit forms 6 (credit-log, booking confirm, schedule editor, survey-flow, nps-modal, poll vote); mutation buttons ~14 (enroll, register, register+pay, cancel-registration, join-waitlist, create-booking, confirm/reject/cancel-booking, pay-invoice, add-to-calendar/ICS, survey submit, poll vote, nps submit, log-credit); icon/menu buttons (EventCard `MoreHorizontal`, training-card menu); tabs (bookings, my-events).

WFs traced: 8/8 member-facing in cluster (WF-052, WF-056, WF-059, WF-065, WF-066, WF-074, WF-101, WF-103) + WF-112 booking + WF-072 verify. Officer WFs (WF-051/058/060/061/053/063/100/102) present in feature components but rendered only under `officer/` routes → out of member scope (cluster D/E).

Routes verified: all internal `Link to=` targets resolve to existing route files EXCEPT the certificate verification URL string (see J-CERT-002).

---

## training / credits

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | Gate | WF | Conf |
|--------|---------|------|-------|---------|-----|------|----|----|
| my/training | available-training card | display only | — | none | listMyCustomTrainings + searchTrainings (GET) | member | WF-059 | High |
| my/credits | Log Manual Credit | Link | "Log Manual Credit" | →/my/credits/log | — | member | WF-066 | High |
| my/credits | EmptyState action | navigate | "Log Manual Credit" | navigate(/my/credits/log) | — | member | WF-066 | High |
| my/credits/log | form submit | submit | "Add Credit Entry" | api.post | POST /api/persons/me/credit-entries | member | WF-066 | High |
| my-cpd | Browse Training/Events | Link | — | →org training/events | — | member | WF-065 | High |
| org/training | training card | Link | — | →$trainingId | searchTrainings (GET) | member | WF-059 | High |
| org/training/$trainingId | Enroll | mutation btn | "Enroll" | enrollMutation.mutate | POST enrollInCustomTraining | member | WF-059 | High |

### Registry 2 — Journey Completion (non-PASS)

| WF | Status | Note |
|----|--------|------|
| WF-059 Training Enrollment | PARTIAL | Enroll works on org/training/$trainingId (full happy path + good error). BUT `my/training` "Available Trainings" cards (network-wide discovery, SO-9) are pure display — no Link/enroll entry point from that surface; member must already know the org/training route. J-TRN-001. |

### Registry 9 — Error-UX (non-PASS)

| Finding | File:Line | Issue |
|---------|-----------|-------|
| J-TRN-002 | my/credits/log.tsx:64 | `toast.error('Failed to add credit entry')` — generic static, no err.code/message interpolation. |

(org/training/$trainingId enroll onError interpolates `err.body.message` — PASS.)

---

## certificates

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | Gate | WF | Conf |
|--------|---------|------|-------|---------|-----|------|----|----|
| my/certificates | cert card | Link | — | →$certificateId | listMyCertificates (GET) | member | WF-074 | High |
| $certificateId / certificate-preview | Download PDF | button | "Download PDF" | `alert(...)` stub | NONE | member | WF-074 | High |
| certificate-preview | Copy Verification Link | button | "Copy Verification Link" | clipboard.writeText(verificationUrl) | — | member | WF-072 | High |

### Registry 5 — Dead Interactions

| Finding | Sev | File:Line | Type | Issue |
|---------|-----|-----------|------|-------|
| J-CERT-001 | P1 | certificate-preview.tsx:45-47 | NOOP_BUTTON | "Download PDF" → `alert('PDF download will be available in a future update.')`. This is the PRIMARY member action for WF-074 (Certificate Download). No API call. WF-074 = BROKEN. |
| J-CERT-002 | P2 | certificate-preview.tsx:43 | BROKEN_LINK | `verificationUrl = origin + '/verify/certificate/' + certificateNumber`. Actual route is `/verify/$certificateNumber` (no `/certificate/` segment). Copied/displayed link resolves to a non-existent path → 404 for whoever scans it. WF-072 public verification broken from this entry. |

### Registry 2 (non-PASS)

| WF | Status | Note |
|----|--------|------|
| WF-074 Certificate Download | BROKEN | Only download affordance is a placeholder alert (J-CERT-001). |
| WF-072 Public Verification (member share path) | PARTIAL | Copy-link works mechanically but copies a wrong URL (J-CERT-002). |

---

## booking

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | Gate | WF | Conf |
|--------|---------|------|-------|---------|-----|------|----|----|
| my/bookings | tabs Find/My | tab | — | local | — | member | — | High |
| host-directory | host card | Link | — | →host/$personId?eventId | listBookingEvents (GET) | member | WF-112 | High |
| booking-list | booking row | Link | — | →$bookingId | listBookings (GET) | member | WF-112 | High |
| host.$personId | slot select | navigate | — | →host/$personId/$slotId | listEventSlots (GET) | member | WF-112 | High |
| host.$personId.$slotId | Request booking | submit | "Request booking" | create.mutate | POST createBooking | member | WF-112 | High |
| $bookingId | Accept/Decline | mutation btn | — | confirm/reject (optimistic) | confirm/rejectBooking | host | WF-112 | High |
| $bookingId | Cancel | mutation btn | — | cancel (optimistic) | cancelBooking | member/host | WF-112 | High |
| $bookingId | Pay | mutation btn | — | pay.mutate → shows checkout link | payInvoice | member | WF-112 | High |
| my/schedule | Publish/Save schedule | submit | "Publish schedule"/"Save changes" | create/updateBookingEvent | POST/PATCH bookingEvent | member | WF-112 | High |

### Registry 9 — Error-UX (non-PASS)

| Finding | Sev | File:Line | Issue |
|---------|-----|-----------|-------|
| J-BOOK-001 | P2 | booking-event-editor.tsx:50,60 | `meta.toast.error: 'Could not save schedule'` (×2) — generic static, no message interpolation. |
| J-BOOK-002 | P2 | my/calendar.tsx:30 | `useQuery` destructures only `isLoading`; no `isError` branch. Query failure falls through to "No events yet" empty state — misleads member into thinking they have no registered events. |

(slot confirm, $bookingId pay/ensureRoom, host pages all interpolate or handle errors explicitly — PASS. Pay button "stub" surfaces real checkout URL → functional, not a noop.)

---

## events

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | Gate | WF | Conf |
|--------|---------|------|-------|---------|-----|------|----|----|
| my/events | Upcoming/All toggle | button | — | local | — | member | WF-056 | High |
| my/events | event card | Link | — | →org/$slug/events/$eventId | listMyCustomEvents (GET) | member | WF-056 | High |
| my/events | Cancel registration | mutation btn | "Cancel" | cancelMutation | cancelEventRegistration | member | WF-052 | High |
| org/events | search/type filter | input/select | — | local | searchEvents (GET) | member | WF-055 | High |
| org/events | EventCard title/view | Link | — | →$eventId | — | member | WF-052 | High |
| org/events/$eventId | Register | mutation btn | "Register"/"Join Waitlist" | registerMutation | registerForCustomEvent | member | WF-052/057 | High |
| org/events/$eventId | Register and Pay | mutation btn | "Register and Pay" | paidRegMutation → Stripe redirect | registerAndPayForEvent | member | WF-052 | High |
| org/events/$eventId | Cancel Registration | mutation btn | — | cancelMutation | cancelEventRegistration | member | WF-052 | High |
| org/events/$eventId | Add to Calendar | button | "Add to Calendar" | downloadIcsFile | client-side ICS | member | WF-056 | High |
| events/$eventSlug (public) | Join Now / Sign In | Link | — | →/join, /auth/sign-in | — | public | WF-052 | High |
| discover/events (public) | search/filters + card | input/Link | — | →/events/$slug | listPublicEvents (GET) | public | WF-055 | High |

All event registration error handlers interpolate `err.body.message ?? err.body.error ?? err.message` — PASS error-UX. WF-052, WF-056, WF-057 (waitlist) COMPLETE.

---

## surveys

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | Gate | WF | Conf |
|--------|---------|------|-------|---------|-----|------|----|----|
| my/surveys | pending survey card | Link | — | →$surveyId | listSurveys?mine (GET) | member | WF-101 | High |
| my/surveys | completed card | display only | — | none (no review of own response) | — | member | WF-101 | Med |
| $surveyId / survey-flow | Next/Back/Submit | submit | "Submit" | api.post responses | POST /surveys/$id/responses | member | WF-101 | High |
| poll-card | option + Vote | mutation btn | "Vote" | voteMut | POST /api/surveys/$id/responses | member | WF-103 | High |
| nps-modal | 0-10 scale + Submit/Dismiss | mutation btn | "Submit"/"Dismiss" | api.post / dismiss | POST responses[/dismiss] | member | WF-103 | High |

### Registry 9 — Error-UX (non-PASS)

| Finding | Sev | File:Line | Issue |
|---------|-----|-----------|-------|
| J-SUR-001 | P2 | survey-flow.tsx:203 | `toast.error('Failed to submit survey. Please try again.')` — generic static. |
| J-SUR-002 | P2 | poll-card.tsx:61 | `onError: () => toast.error('Failed to vote')` — generic static. |
| J-SUR-003 | P2 | nps-modal.tsx:82 | `toast.error('Failed to submit. Please try again.')` — generic static. |

WF-101 (respond) and WF-103 (quick poll / NPS) COMPLETE; only generic-error-toast issues. Completed surveys not re-reviewable (minor; BR-40 anonymity may justify).

---

## Officer-facing components present but out of member scope

`post-event-actions.tsx`, `attendance-view.tsx`, `event-list.tsx`, `completion-table.tsx`, `event-form.tsx`, `training-form.tsx`, `training-list.tsx`, `survey-list.tsx`, `survey-builder.tsx` render only under `org/$orgSlug/officer/*` routes (cluster D/E). Scanned for completeness; one observation worth flagging to the officer-cluster auditor:

| Finding | Sev | File:Line | Issue |
|---------|-----|-----------|-------|
| J-TRN-003 | P2 | completion-table.tsx:84-87,110-112 | `completeCustomTraining` mark/markAll mutations `onError` only roll back optimistic state — NO `toast.error`. Officer marking attendance gets a silent failure (checkmark reverts with no explanation). |
| J-SUR-004 | P2 | survey-list.tsx:103,112,121,130; survey-builder.tsx:142 | Officer survey publish/close/delete/clone/create all use generic static `toast.error('Failed to …')`. |

---

## Findings summary

| ID | Sev | Module | File:Line | Issue | Fix |
|----|-----|--------|-----------|-------|-----|
| J-CERT-001 | P1 | certificates | certificate-preview.tsx:45-47 | "Download PDF" is an `alert()` stub — WF-074 primary action broken | Wire to a real certificate-PDF download endpoint (or hide button until available) |
| J-CERT-002 | P2 | certificates | certificate-preview.tsx:43 | Verification URL `/verify/certificate/{n}` ≠ actual route `/verify/{n}` → copied link 404s | Build URL as `${origin}/verify/${certificateNumber}` |
| J-TRN-001 | P2 | training | my/training.tsx:178-193 | "Available Trainings" discovery cards are non-interactive — no enroll/view entry point | Wrap cards in `Link to=org/$slug/training/$trainingId` |
| J-TRN-002 | P2 | training | my/credits/log.tsx:64 | Generic credit-entry error toast | Interpolate server err.message |
| J-TRN-003 | P2 | training(officer) | completion-table.tsx:84,110 | Mark-completion failures silent (rollback only, no toast) | Add `toast.error(err.message)` in onError |
| J-BOOK-001 | P2 | booking | booking-event-editor.tsx:50,60 | Generic schedule-save error toast | Interpolate err.message |
| J-BOOK-002 | P2 | booking | my/calendar.tsx:30 | No isError branch — failure shows "No events" empty state | Add error branch distinct from empty |
| J-SUR-001 | P2 | surveys | survey-flow.tsx:203 | Generic survey-submit error toast | Interpolate err.message |
| J-SUR-002 | P2 | surveys | poll-card.tsx:61 | Generic poll-vote error toast | Interpolate err.message |
| J-SUR-003 | P2 | surveys | nps-modal.tsx:82 | Generic NPS-submit error toast | Interpolate err.message |
| J-SUR-004 | P2 | surveys(officer) | survey-list.tsx:103/112/121/130; survey-builder.tsx:142 | Generic officer survey-action error toasts | Interpolate err.message |

### Severity counts

| Sev | Count |
|-----|-------|
| P0 | 0 |
| P1 | 1 |
| P2 | 10 |
| P3 | 0 |

Status: COMPLETE (37/37 inventoried files scanned).
