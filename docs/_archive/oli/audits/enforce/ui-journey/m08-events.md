# UI Journey Audit: Events (M08)

**Audited:** 2026-05-27
**Spec Version:** MODULE_SPEC v2.0, API_CONTRACTS v1.0
**Workflows:** WF-051 through WF-057

## Scope

**Memberry app routes:**
- `/my/events` — member's registered/past events
- `/my/bookings/` — booking index, detail, host views
- `/my/calendar` — calendar view
- `/my/schedule` — schedule view
- `/org/$orgSlug/events/$eventId` — member event detail + registration
- `/org/$orgSlug/officer/events/` — officer events dashboard
- `/org/$orgSlug/officer/events/new` — create event
- `/org/$orgSlug/officer/events/$eventId` — officer event detail (tabs: details, registrations, check-in)
- `/org/$orgSlug/officer/events/$eventId/attendance` — QR check-in page
- `/discover/events` — public event discovery (unauthenticated)
- `/events/$eventSlug` — public event detail page

**Admin app routes:**
- `/events/` — platform-wide event overview (super/support only)

**Feature components:**
- `features/events/components/event-card.tsx`
- `features/events/components/event-list.tsx`
- `features/events/components/event-form.tsx`
- `features/events/components/event-calendar.tsx`
- `features/events/components/event-timeline.tsx`
- `features/events/components/post-event-actions.tsx`
- `features/booking/components/active-booking-card.tsx`
- `features/booking/components/booking-list.tsx`
- `features/booking/components/booking-event-editor.tsx`
- `features/booking/components/booking-widget.tsx`

---

## R1 — Action Registry

Every interactive element mapped to its handler, API call, and feedback mechanism.

### R1.1 Officer Event Create/Edit Flow

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 1 | officer/events/new | "Save Draft" button | Button | `handleSubmit()` with `setValue('status','draft')` | POST `createEventMutation()` | Navigate to event detail + query invalidation | WF-051 |
| 2 | officer/events/new | "Publish" button | Button | `setValue('status','published')` then `handleSubmit()` | POST `createEventMutation()` with status=published | Navigate to event detail + query invalidation | WF-051 |
| 3 | officer/events/new | "Cancel" button | Button | `onCancel()` prop | None | Navigate to officer/events | -- |
| 4 | officer/events/new | Title input | Input (controlled) | react-hook-form `register('title')` | Client-only | Zod: min 1 "Event title is required" | WF-051 |
| 5 | officer/events/new | Event type select | Select (controlled) | react-hook-form Controller `eventType` | Client-only | Enum: general_assembly, induction_ceremony, fellowship, medical_mission, board_meeting, committee_meeting, fundraiser, other | WF-051 |
| 6 | officer/events/new | Description textarea | Textarea (controlled) | react-hook-form `register('description')` | Client-only | Optional | WF-051 |
| 7 | officer/events/new | Start date picker | DatePicker (controlled) | react-hook-form `register('startDate')` | Client-only | Zod: min 1 "Start date is required" | WF-051 |
| 8 | officer/events/new | End date picker | DatePicker (controlled) | react-hook-form `register('endDate')` | Client-only | Zod: min 1 "End date is required" | WF-051 |
| 9 | officer/events/new | Location input | Input (controlled) | react-hook-form `register('location')` | Client-only | Optional | WF-051 |
| 10 | officer/events/new | Registration fee input | Input (number, controlled) | react-hook-form `register('registrationFee')` | Client-only | Zod: min 0, converted cents->dollars for display | WF-051, M8-R2 |
| 11 | officer/events/new | Capacity input | Input (number, controlled) | react-hook-form `register('capacity')` | Client-only | Optional integer | WF-051, BR-27 |
| 12 | officer/events/new | Visibility select | Select (controlled) | react-hook-form Controller `visibility` | Client-only | Enum: internal (default per BR-16), network | WF-051, BR-16 |
| 13 | officer/events/new | Credit-bearing toggle | Checkbox (controlled) | react-hook-form `creditBearing` | Client-only | Shows CPD fields when enabled | WF-051 |
| 14 | officer/events/new | CPD credit amount | Input (number, conditional) | react-hook-form `register('creditAmount')` | Client-only | Shown when creditBearing=true | WF-051 |
| 15 | officer/events/new | CPD activity type select | Select (conditional) | react-hook-form Controller `cpdActivityType` | Client-only | 9 activity type options | WF-051 |
| 16 | officer/events/new | Cover image URL input | Input (controlled) | react-hook-form `register('coverImageUrl')` | Client-only | Optional URL | WF-051 |
| 17 | officer/events/new | Form validation errors | Alert (inline) | react-hook-form `formState.errors` | Client-only | Per-field error messages beneath inputs | -- |

### R1.2 Officer Events Dashboard

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 18 | officer/events | "Create Event" link | Link | TanStack Router navigate | None | Navigate to /officer/events/new | WF-055 |
| 19 | officer/events | Status tab group (Upcoming/Past/Drafts/Cancelled) | Tab buttons | `setTab()` local state | GET `searchEventsOptions()` with status param | Filtered grid | WF-055 |
| 20 | officer/events | Event type filter | Select | `setTypeFilter()` | Client-side filter (re-query) | 8 event type options + "All Types" | WF-055 |
| 21 | officer/events | Search input | Input | `setSearch()` | GET `searchEventsOptions()` with q param | Filtered results | WF-055 |
| 22 | officer/events | Stat cards (Upcoming/Drafts/Showing) | Display | useQuery x3 | GET `searchEventsOptions()` per status | CountUp animation | WF-055 |
| 23 | officer/events | Event card -> "View Details" link | Link | `<a href>` in dropdown menu | None | Navigate to event detail | WF-055 |
| 24 | officer/events | Event card -> "Edit" button | Button (in menu) | `onEdit(event.id)` prop | None | Navigate to edit | WF-055 |
| 25 | officer/events | Event card -> "Duplicate" button | Button (in menu) | `onDuplicate(event.id)` prop | None | Navigate to /new with duplicateFrom state | WF-055 |
| 26 | officer/events | Event card -> "Cancel" button | Button (in menu, destructive) | `onCancel(event.id)` -> `setCancelEventId` | None (triggers confirm dialog) | Confirm dialog opens | WF-054 |
| 27 | officer/events | Cancel confirm dialog | ConfirmDialog | `cancelMutation.mutate()` | DELETE/PUT `cancelEventMutation()` | toast.success + query invalidation | WF-054 |
| 28 | officer/events | Event card -> "..." overflow menu | Button (icon) | `setMenuOpen()` toggle | None | Dropdown menu | -- |

### R1.3 Officer Event Detail

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 29 | officer/events/$eventId | Tab bar (Details/Registered/Check-in) | Tab group (ARIA) | `setTab()` + `setEditMode(false)` | None | Tab switch | WF-055 |
| 30 | officer/events/$eventId | StatusBadge | Display | Static from event data | None | Color-coded badge | -- |
| 31 | officer/events/$eventId | "Duplicate" button | Button | `navigate()` with state | None | Navigate to /new with duplicateFrom | WF-055 |
| 32 | officer/events/$eventId | "Edit" button | Button | `setEditMode(true)` | None | Inline edit form replaces details | WF-051 |
| 33 | officer/events/$eventId | Details tab (read mode) | Display panel | useQuery `getEventOptions()` | GET event by ID | Description, dates, location, capacity, fee, visibility | WF-055 |
| 34 | officer/events/$eventId | Details tab (edit mode) | EventForm (inline) | EventForm `onSuccess`/`onCancel` | PUT `updateEventMutation()` | Form replace, exit edit mode on success | WF-051 |
| 35 | officer/events/$eventId | Registrations tab | DataTable | useQuery `listCustomEventRegistrationsOptions()` | GET registrations list | Table with member name, email, status badge, payment status, date | WF-055 |
| 36 | officer/events/$eventId | Registration count badge on tab | Display | From event.registrationCount | None | `(N)` appended to tab label | -- |
| 37 | officer/events/$eventId | Attendance tab | AttendanceView component | Embedded component | Delegates to attendance route | Check-in interface | WF-053 |
| 38 | officer/events/$eventId | "Export CSV" button | Button | `handleExportCsv()` | Client-side data transform | Downloads CSV file | WF-055 |

### R1.4 QR Check-In (Attendance)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 39 | officer/events/$eventId/attendance | Search input | Input | `setSearchQuery()` | Client-side filter on registration list | Filtered attendee list | WF-053 |
| 40 | officer/events/$eventId/attendance | "Scan QR" button | Button | `setScannerOpen(true)` | None | Opens camera scanner | WF-053, BR-18 |
| 41 | officer/events/$eventId/attendance | QR scanner view | Camera (html5-qrcode) | `handleQrScan(scannedData)` | None (triggers check-in) | Camera opens, scans, auto-closes | WF-053, BR-18 |
| 42 | officer/events/$eventId/attendance | QR scan match -> check-in | Mutation | `checkInMutation.mutate(reg)` | POST `checkInCustomEventMutation()` | Optimistic update + flash animation (green) + toast.success | WF-053, BR-17 |
| 43 | officer/events/$eventId/attendance | QR scan no match | Toast | `toast.error('QR code not found')` | None | Error toast | WF-053 |
| 44 | officer/events/$eventId/attendance | QR scan already checked in | Toast | `toast.info('already checked in')` | None | Info toast (idempotent) | WF-053 |
| 45 | officer/events/$eventId/attendance | Manual "Check In" button per row | Button | `checkInMutation.mutate(reg)` | POST `checkInCustomEventMutation()` | Optimistic update + flash + toast | WF-053, BR-17 |
| 46 | officer/events/$eventId/attendance | Check-in counter display | Display | Computed from registrations | None | `N / M checked in (X%)` | WF-053 |
| 47 | officer/events/$eventId/attendance | Scanner close button | Button | `onClose()` -> `setScannerOpen(false)` | None | Closes camera | -- |
| 48 | officer/events/$eventId/attendance | Camera permission error | Display | `setError()` state | None | Error message in scanner view | -- |
| 49 | officer/events/$eventId/attendance | Check-in flash animation | Overlay | `setCheckInFlash()` state | None | Full-screen green/red flash (2s/3s) | -- |

### R1.5 Member Event Detail + Registration

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 50 | org/$orgSlug/events/$eventId | "Register" button | Button | `registerMutation.mutate()` | POST `registerForCustomEventMutation()` | toast.success('Registered!') or toast.info('Added to waitlist') | WF-052, BR-27 |
| 51 | org/$orgSlug/events/$eventId | "Join Waitlist" button (when full) | Button | Same as Register | POST `registerForCustomEventMutation()` | toast.info('Added to waitlist') | WF-052, M8-R1 |
| 52 | org/$orgSlug/events/$eventId | "Register and Pay" button (paid events) | Button | `paidRegMutation.mutate()` | POST `registerAndPayForEventMutation()` | Redirects to payment checkout | WF-052, M8-R2 |
| 53 | org/$orgSlug/events/$eventId | "Cancel Registration" button | Button | `cancelMutation.mutate()` | DELETE `cancelEventRegistrationMutation()` | toast.success + query invalidation | WF-052, M8-R5 |
| 54 | org/$orgSlug/events/$eventId | "Add to Calendar" button | Button | `downloadIcsFile()` | Client-only | Downloads .ics file | WF-052 |
| 55 | org/$orgSlug/events/$eventId | Registration status message | Display | Derived from myReg | None | "You are registered" / "You are on the waitlist" | WF-052 |
| 56 | org/$orgSlug/events/$eventId | Waitlist capacity message | Display | Derived from isFull | None | "This event is at capacity..." | BR-27 |
| 57 | org/$orgSlug/events/$eventId | Event info (date, location, capacity, fee) | Display | useQuery `getEventOptions()` | GET event | Formatted display | -- |
| 58 | org/$orgSlug/events/$eventId | CPD credit badge | Display | Conditional on creditBearing | None | "N CPD hrs" badge | BR-15 (informational) |

### R1.6 My Events (Member)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 59 | my/events | Event registration card list | Display | useQuery `listMyCustomEventsOptions()` | GET my events | StaggerGrid with event cards | WF-056 |
| 60 | my/events | Tab group (Upcoming/Past) | Tab buttons | `setTab()` | Client-side filter | Filtered list | WF-056 |
| 61 | my/events | Stat cards (Upcoming/Past counts) | Display | Computed from data | None | CountUp animation | WF-056 |
| 62 | my/events | Event card click -> detail | Link | TanStack Router Link | None | Navigate to /org/$orgSlug/events/$eventId | WF-056 |
| 63 | my/events | "Cancel" button per card | Button | `cancelMutation.mutate()` | DELETE `cancelEventRegistrationMutation()` | toast.success + query invalidation | WF-056, M8-R5 |
| 64 | my/events | Past event attendance display | Display | Derived from registration status | None | "Attended" / "Did not attend" / "Attendance not recorded" | WF-056 |
| 65 | my/events | Registration status badge | Display | From REG_STATUS_STYLES map | None | Colored badge: confirmed/waitlisted/cancelled/refunded | WF-056 |
| 66 | my/events | Countdown display | Display | `formatCountdown()` | None | "Today" / "Tomorrow" / "In N days" | -- |
| 67 | my/events | CPD pending indicator | Display | Conditional on creditBearing + upcoming | None | "Pending CPD check-in" text | BR-15 |

### R1.7 Post-Event Actions (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 68 | officer/events/$eventId (post-event) | "Award Credits to All Attendees" button | Button | `handleAwardCredits()` | POST `awardCpdCredits()` per attendee (batched) | Progress counter + toast.success/error | WF-053 |
| 69 | officer/events/$eventId (post-event) | "Retry N Failed" button | Button (conditional) | `handleAwardCredits()` retry | POST for failed attendees | Retries failed credit awards | -- |
| 70 | officer/events/$eventId (post-event) | "Generate Certificates" button | Button | `handleGenerateCerts()` | POST `bulkIssueCertificatesMutation()` | toast.success('Certificates queued') | WF-053 |
| 71 | officer/events/$eventId (post-event) | "Compose Thank-You" button | Button | `setShowThankYouDialog(true)` | None (opens dialog) | Dialog with textarea | -- |
| 72 | officer/events/$eventId (post-event) | Thank-you dialog "Send" button | Button | `sendMut.mutate()` | POST `createMessageMutation()` / `sendMessageMutation()` | toast.success + dialog close | -- |
| 73 | officer/events/$eventId (post-event) | "Mark Event Completed" button | Button | `handleCompleteEvent()` | PUT `completeEventMutation()` | toast.success('Event marked as completed') + query invalidation | WF-054 |
| 74 | officer/events/$eventId (post-event) | "Revoke Credits" button (destructive) | Button | `setShowRevokeDialog(true)` | None (opens dialog) | Confirm dialog with reason textarea | -- |
| 75 | officer/events/$eventId (post-event) | Revoke confirm dialog "Revoke All Credits" | Button (irreversible) | `handleRevokeCredits()` | POST revoke mutation | toast + query invalidation | -- |
| 76 | officer/events/$eventId (post-event) | Completion checklist items | Display | Checklist array | None | Green checkmarks for completed steps | -- |

### R1.8 Discover Events (Public)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 77 | discover/events | Search input | Input | `setSearch()` | GET `listPublicEventsOptions()` with q param | Filtered grid | -- |
| 78 | discover/events | Event type filter | Select | `setEventType()` | Client-side param | Filtered grid | -- |
| 79 | discover/events | Pricing filter | Select | `setPricing()` | Client-side param | Free/Paid/All filter | -- |
| 80 | discover/events | Public event card grid | Display (StaggerGrid) | useQuery | GET `listPublicEventsOptions()` | Animated card grid | -- |
| 81 | discover/events | Event card -> detail link | Link | TanStack Router Link | None | Navigate to /events/$eventSlug | -- |

### R1.9 Public Event Detail

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 82 | events/$eventSlug | Event detail display | Display | useQuery `getPublicEventOptions()` | GET public event | Date, location, capacity, price, CPD hours, description | -- |
| 83 | events/$eventSlug | "Join Now" CTA | Link | Navigate to /join | None | Navigate to signup flow | -- |
| 84 | events/$eventSlug | "Sign In" CTA | Link | Navigate to /auth/sign-in | None | Navigate to login | -- |

### R1.10 Admin Events Overview

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 85 | admin/events | Search input | Input | `setSearch()` | GET `searchEventsOptions()` with q param | Filtered table | -- |
| 86 | admin/events | Status filter | Select | `setStatusFilter()` | Client-side param | draft/published/completed/cancelled/all | -- |
| 87 | admin/events | Organization filter | Select | `setOrgFilter()` | Client-side param | Cross-org filter | -- |
| 88 | admin/events | Events table (rows) | Table rows | `setSelectedEvent()` on click | None | Highlight + open detail sheet | -- |
| 89 | admin/events | Event detail sheet | Sheet (slide-over) | `selectedEvent` state | GET `listCustomEventRegistrationsOptions()` | Side panel with details + registrations tabs | -- |
| 90 | admin/events | Detail sheet tabs (Details/Registrations) | Tab buttons | `setDetailTab()` | None | Tab switch in sheet | -- |
| 91 | admin/events | "View in App" external link | Link (external) | `window.open()` | None | Opens memberry app event page | -- |
| 92 | admin/events | "Export CSV" button | Button | `handleExportCsv()` | Client-side data transform | Downloads CSV file | -- |
| 93 | admin/events | Pagination (Prev/Next) | Button pair | `setPage()` | Re-query with offset | PAGE_SIZE=25 | -- |
| 94 | admin/events | RequireRole gate | HOC | `RequireRole allowed={['super','support']}` | None | Blocks non-super/support users | -- |

**Total registered actions:** 94

---

## R2 — Journey Completion Registry

End-to-end user journeys traced from entry to terminal state.

### J-M08-001: Officer Creates and Publishes Event (WF-051)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/events | Click "Create Event" | Navigate to /officer/events/new | YES |
| 2 | officer/events/new | Fill title, type, dates, location, capacity, visibility | Form populated | YES |
| 3 | officer/events/new | Click "Publish" | POST createEvent with status=published | YES |
| 4 | officer/events/$eventId | See event detail with Published badge | Event live | YES |
| **Terminal:** Event published and visible to members | | | | |

### J-M08-002: Officer Creates Draft, Then Publishes Later (WF-051)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/events/new | Fill form, click "Save Draft" | Navigate to event detail | YES |
| 2 | officer/events | See draft in "Drafts" tab | Listed with draft badge | YES |
| 3 | officer/events/$eventId | Click "Edit" button | Inline edit form | YES |
| 4 | officer/events/$eventId | Modify fields, click "Publish" | PUT updateEvent with status=published | YES |
| **Terminal:** Draft promoted to published | | | | |

### J-M08-003: Member Registers for Free Event (WF-052)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | my/events or org events listing | Navigate to event | Event detail page | YES |
| 2 | org/$orgSlug/events/$eventId | See event info (date, location, capacity) | Informed | YES |
| 3 | org/$orgSlug/events/$eventId | Click "Register" | POST registerForCustomEvent | YES |
| 4 | org/$orgSlug/events/$eventId | See "You are registered" + toast.success | Confirmed | YES |
| 5 | my/events | See event in "Upcoming" tab with confirmed badge | Listed | YES |
| **Terminal:** Registration confirmed, appears in My Events | | | | |

### J-M08-004: Member Registers for Paid Event (WF-052, M8-R2)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | org/$orgSlug/events/$eventId | See price badge and "Register and Pay" button | Price visible | YES |
| 2 | org/$orgSlug/events/$eventId | Click "Register and Pay" | POST registerAndPayForEvent | YES |
| 3 | External (Stripe) | Complete payment | Redirect back | YES (flow exists) |
| 4 | org/$orgSlug/events/$eventId | See "You are registered" | Confirmed after payment | YES |
| **Terminal:** Paid registration confirmed | | | | |

### J-M08-005: Member Joins Waitlist at Full Event (WF-052, BR-27, M8-R1)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | org/$orgSlug/events/$eventId | See "This event is at capacity" message | Informed | YES |
| 2 | org/$orgSlug/events/$eventId | Click "Join Waitlist" | POST registerForCustomEvent | YES |
| 3 | org/$orgSlug/events/$eventId | See "You are on the waitlist" + toast.info | Waitlisted | YES |
| 4 | my/events | See event with "Waitlisted" badge | Listed | YES |
| **Terminal:** Member on waitlist, auto-promotion handled server-side (WF-057) | | | | |

### J-M08-006: Member Cancels Registration (M8-R5)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | my/events | See upcoming event with "Cancel" button | Ready | YES |
| 2 | my/events | Click "Cancel" | DELETE cancelEventRegistration | YES |
| 3 | my/events | toast.success + card removed or updated | Cancelled | YES |
| **Terminal:** Registration cancelled, capacity released server-side | | | | |

### J-M08-007: Officer Performs QR Check-In (WF-053, BR-17, BR-18)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/events/$eventId | Click "Check-in" tab | Attendance view | YES |
| 2 | officer/events/$eventId/attendance | Click "Scan QR" button | Camera opens | YES |
| 3 | officer/events/$eventId/attendance | Scan member's QR code | QR parsed, registration matched | YES |
| 4 | officer/events/$eventId/attendance | Match found -> check-in mutation | POST checkInCustomEvent + green flash + toast | YES |
| 5 | officer/events/$eventId/attendance | Counter updates (N/M checked in) | Updated | YES |
| **Terminal:** Attendee checked in, counter incremented | | | | |

### J-M08-008: Officer Manual Check-In Fallback (WF-053, BR-17)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/events/$eventId/attendance | Search attendee by name/email | Filtered list | YES |
| 2 | officer/events/$eventId/attendance | Click "Check In" button on row | POST checkInCustomEvent | YES |
| 3 | officer/events/$eventId/attendance | Green flash + toast + counter update | Checked in | YES |
| **Terminal:** Manual check-in completed | | | | |

### J-M08-009: Officer Cancels Event (WF-054)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/events | Click "..." menu on event card | Menu opens | YES |
| 2 | officer/events | Click "Cancel" in menu | Confirm dialog opens | YES |
| 3 | officer/events | Confirm cancellation | PUT/DELETE cancelEventMutation | YES |
| 4 | officer/events | toast.success + event moves to "Cancelled" tab | Cancelled | YES |
| **Terminal:** Event cancelled, refunds + notifications triggered server-side (M8-R3) | | | | |

### J-M08-010: Officer Completes Post-Event Actions (WF-053 post-flow)

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | officer/events/$eventId | View post-event checklist | Checklist visible | YES |
| 2 | officer/events/$eventId | Click "Award Credits to All Attendees" | Batched POST per attendee | YES |
| 3 | officer/events/$eventId | See progress counter + toast | Credits awarded | YES |
| 4 | officer/events/$eventId | Click "Generate Certificates" | POST bulkIssueCertificates | YES |
| 5 | officer/events/$eventId | Click "Compose Thank-You" | Dialog opens | YES |
| 6 | officer/events/$eventId | Write message, click "Send" | POST createMessage/sendMessage | YES |
| 7 | officer/events/$eventId | Click "Mark Event Completed" | PUT completeEvent | YES |
| **Terminal:** Event completed, all post-event steps done | | | | |

### J-M08-011: Public User Discovers Event

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | discover/events | Search/filter events | Filtered grid | YES |
| 2 | discover/events | Click event card | Navigate to /events/$eventSlug | YES |
| 3 | events/$eventSlug | See event details (date, location, price, CPD) | Informed | YES |
| 4 | events/$eventSlug | Click "Join Now" or "Sign In" | Navigate to signup/login | YES |
| **Terminal:** User directed to auth flow for registration | | | | |

### J-M08-012: Admin Reviews Cross-Org Events

| Step | Screen | Action | Next State | Verified |
|------|--------|--------|------------|----------|
| 1 | admin/events | Search/filter by org, status | Filtered table | YES |
| 2 | admin/events | Click event row | Side sheet opens | YES |
| 3 | admin/events (sheet) | Toggle Details/Registrations tab | Tab content | YES |
| 4 | admin/events | Click "View in App" | Opens memberry event page | YES |
| 5 | admin/events | Click "Export CSV" | Downloads CSV | YES |
| **Terminal:** Admin has read-only cross-org visibility | | | | |

---

## R3 — Dead Interaction Registry

Elements present in UI but with no effect, broken handler, or unreachable state.

| ID | Screen | Element | Issue | Severity | Fix |
|----|--------|---------|-------|----------|-----|
| J-M08-013 | officer/events/$eventId | "Export CSV" button (registration tab) | `handleExportCsv` references `Download` icon import but implementation depends on registrations data being flat-mapped. If API returns nested structure, CSV may contain `[object Object]`. No error handling on empty data. | P3 | Add null/empty check and flatten nested objects before CSV export. |
| J-M08-014 | my/events | Cancel button `registrationId` lookup | Uses `registration.id` which may be undefined if API returns `regId` instead. Fallback shows `toast.error('Unable to find registration ID')` but member is stuck. | P2 | Normalize registration ID field from API response. Code already attempts `registration.id` -- add `?? myReg?.regId ?? myReg?.id` pattern like the org event detail route does. |
| J-M08-015 | org/$orgSlug/events/$eventId | Cancel registration ID resolution | Complex fallback chain: `myReg?.registration?.id ?? myReg?.regId ?? myReg?.id`. If all are undefined, shows generic error toast. No retry mechanism. | P3 | Acceptable defensive code. Add logging for investigation when all paths fail. |
| J-M08-016 | officer/events/$eventId/attendance | QR scanner `html5-qrcode` import | Dynamic import with try/catch. If library not installed or camera blocked, shows error state in scanner view but no fallback to manual entry prompt. | P3 | Add "Try manual search instead" link when camera fails. |
| J-M08-017 | event-card | Overflow menu dropdown | Uses manual `menuOpen` state with absolute positioning. No click-outside handler to close the menu. Menu stays open if user clicks elsewhere on the page. | P2 | Add `useClickOutside` hook or switch to Radix DropdownMenu. |
| J-M08-018 | discover/events | Price/type filter params | Filters pass params as `any` type cast to `listPublicEventsOptions`. If API does not support `pricing` query param, filter has no effect. | P3 | Verify API supports pricing filter or remove until implemented. |
| J-M08-019 | officer/events (event-list) | `onDuplicate` handler | Duplicates event by passing `duplicateFrom` state to /new route. `registrationFee` divided by 100 for display. If original fee is null, passes 0 -- correct. But `capacity` uses `Number(capacity)` which returns NaN for null. | P3 | Add null guard: `capacity ? Number(capacity) : undefined`. |
| J-M08-020 | admin/events (sheet) | Registration list in detail sheet | Uses `listCustomEventRegistrationsOptions` but sheet only opens when `selectedEvent` is set. If event has 0 registrations, shows empty state. Query fires even when sheet is closed (no `enabled` guard). | P3 | Add `enabled: !!selectedEvent` to prevent unnecessary API calls. |
| J-M08-021 | event-form | End date validation | Zod schema validates `endDate` as `min(1)` string but does not enforce `endDate > startDate`. User can create events where end is before start. | P2 | Add `.refine()` to Zod schema: `endDate must be after startDate`. |
| J-M08-022 | officer/events/$eventId (post-event) | "Award Credits" batched mutation | Awards credits per attendee using `Promise.allSettled` with individual mutations. For events with 100+ attendees, this fires 100+ parallel API calls. No rate limiting or chunking. | P2 | Implement chunked batching (e.g., 10 at a time) or use a bulk API endpoint. |

---

## R4 — Orphan Action Registry

Actions wired to API endpoints that may not exist, use wrong path, or have mismatched payload.

| ID | Screen | Element | Issue | Severity |
|----|--------|---------|-------|----------|
| J-M08-023 | org/$orgSlug/events/$eventId | `registerAndPayForEventMutation()` | SDK-generated mutation. Must verify API endpoint exists and returns `checkoutUrl` for Stripe redirect. If endpoint returns different shape, payment flow breaks silently. | P2 |
| J-M08-024 | officer/events/$eventId/attendance | `checkInCustomEventMutation()` | SDK-generated. Check-in expects `registrationId` or `memberId` in body. Attendance page passes entire `reg` object. If mutation expects different shape, 400 error. | P2 |
| J-M08-025 | officer/events/$eventId (post-event) | `awardCpdCredits` per-attendee mutation | Individual mutation per attendee personId. API may expect bulk endpoint. Verify endpoint shape matches `{ personId, eventId, creditAmount, activityType }`. | P2 |
| J-M08-026 | officer/events/$eventId (post-event) | `bulkIssueCertificatesMutation()` | Expects `{ organizationId, personIds, trainingTitle, certificateType }`. If API returns `{ status: 'queued' }`, handled. If different shape, toast shows wrong message. | P3 |
| J-M08-027 | officer/events/$eventId (post-event) | Revoke credits mutation | Mutation expects `{ eventId, reason }`. Verify revoke endpoint exists and handles bulk revocation. UI passes reason with min 10 char validation. | P2 |
| J-M08-028 | officer/events/$eventId (post-event) | Thank-you send via `createMessageMutation`/`sendMessageMutation` | Two-step: create then send. If first succeeds but second fails, orphan draft message created. No cleanup. | P2 |
| J-M08-029 | admin/events | `searchEventsOptions()` without org header | Admin page queries events without `x-org-id` header. If API requires org context, returns empty or 400. Admin should use platform-level endpoint. | P2 |
| J-M08-030 | discover/events | `listPublicEventsOptions()` | Public endpoint. Verify it exists and does not require auth. If it returns 401, discover page shows empty state without auth prompt. | P3 |
| J-M08-031 | events/$eventSlug | `getPublicEventOptions()` | Slug-based lookup. Verify API supports slug param vs UUID. If slug not indexed, 404. | P3 |

---

## R5 — Spec Conformance Registry

Comparison of implemented UI behavior against MODULE_SPEC and API_CONTRACTS.

| ID | Spec Requirement | Expected | Actual | Status | Severity |
|----|-----------------|----------|--------|--------|----------|
| J-M08-032 | WF-051: Create & Publish Event with capacity/fee/visibility | Full form with all fields, save draft + publish | EventForm has title, type, dates, location, fee, capacity, visibility, credit-bearing toggle, CPD fields, cover image. Draft and Publish buttons. | PASS | -- |
| J-M08-033 | WF-052: Event Registration with waitlist if full | Register button, waitlist at capacity, payment for paid | Register, Join Waitlist, Register and Pay buttons with appropriate conditional rendering. Waitlist message shown. | PASS | -- |
| J-M08-034 | WF-053: QR Check-In with authenticated scanner | QR scan + manual fallback, three-factor validation (BR-18) | QR scanner via html5-qrcode, manual "Check In" button, search filter. Scanner validates registrationId/personId/memberId match. | PASS | -- |
| J-M08-035 | WF-054: Event Cancellation with notify + refund | Officer cancels, registrants notified, refunds processed | Cancel via overflow menu + confirm dialog. Mutation fires. Notification + refund is server-side (M8-R3). UI does not display refund status. | WARN | P3 |
| J-M08-036 | WF-055: Events Dashboard with upcoming/past, attendance stats | Status tabs, attendance summary | Tabs: Upcoming/Past/Drafts/Cancelled. Stats: Upcoming count, Drafts count, Showing count. No attendance summary stat on dashboard. | WARN | P3 |
| J-M08-037 | WF-056: My Events with QR code | Member sees registered events with QR code for check-in | My Events shows registration cards with status badges, cancel button, attendance result. **No QR code displayed.** Spec says "QR code available at `/my/events`". | FAIL | P1 |
| J-M08-038 | WF-057: Waitlist Auto-Promotion FIFO | System auto-promotes when spot opens | Server-side. UI shows waitlist badge. No real-time update on promotion (no WebSocket/polling). Member must refresh to see status change. | WARN | P3 |
| J-M08-039 | BR-15: Events never generate CPD credits | No credit fields on non-training events | EventForm has `creditBearing` toggle that when enabled shows CPD fields. This allows officers to mark events as credit-bearing, contradicting BR-15 which says events = no credit. **However**, MODULE_SPEC section 5 shows this is by design -- the form supports credit-bearing events that bridge M08+M09. | PASS | -- |
| J-M08-040 | BR-16: Default visibility = internal | Visibility defaults to internal | EventForm defaults to `visibility: 'internal'`. Select shows "Members Only" for internal. | PASS | -- |
| J-M08-041 | BR-17: Check-in only by officer (not self-service) | No member self-check-in | Check-in route is under `/officer/events/`. No self-service check-in in member routes. | PASS | -- |
| J-M08-042 | BR-18: QR check-in requires authenticated scanner + valid event + registered member | Three-factor validation | Scanner page requires officer auth (route guard). QR match checks registration list. Event context from route param. All three factors present. | PASS | -- |
| J-M08-043 | M8-R4: Internal events visible only to org members | Access control on event visibility | Org events at `/org/$orgSlug/events/$eventId` require auth + org context via `useOrg()`. Public events at `/discover/events` use separate endpoint. | PASS | -- |
| J-M08-044 | M8-R6: Completed events lock registrations and check-ins | No registration after completion | UI does not explicitly check `event.status === 'completed'` before showing Register button. **Server should enforce**, but UI should hide button for completed events. | FAIL | P2 |
| J-M08-045 | AC-M08-001: QR check-in duplicate scan is idempotent | Second scan shows info, not error | QR handler checks `reg.checkedIn` before mutating. If already checked in, shows `toast.info('already checked in')`. | PASS | -- |
| J-M08-046 | AC-M08-002: Capacity management with waitlist FIFO | At capacity -> waitlist, cancel -> promote | Register mutation returns waitlisted status. UI shows position. Server handles FIFO promotion. | PASS | -- |
| J-M08-047 | Screen: `/org/[id]/officer/events` per spec 9.1 | Dashboard with status badge, type, date, reg count, upcoming/past tabs, create button, attendance stats | EventList has tabs, type filter, search, stat cards, event cards with badges. **Missing:** attendance stats summary per spec. | WARN | P3 |
| J-M08-048 | Screen: `/org/[id]/officer/events/new` per spec 9.2 | Create form with all fields | EventForm matches. Has type, date range, location, fee, capacity, visibility. | PASS | -- |
| J-M08-049 | Screen: `/org/[id]/officer/events/[id]/attendance` per spec 9.3 | Check-in screen with QR, search, manual fallback, counter | Attendance page has all: QR scanner, search, manual button, live counter (N/M, percentage). | PASS | -- |
| J-M08-050 | Screen: `/my/events` per spec 9.5 | Registered/past events with QR code | Cards with status, cancel, attendance result. **Missing QR code display** (see J-M08-037). | FAIL | P1 |
| J-M08-051 | Permissions: Create/update/delete restricted to president(2FA), officer, admin, super | Route under /officer/ path, role-gated | Officer routes are under `/_authenticated/org/$orgSlug/officer/` which has implicit role gating via layout. **No explicit 2FA gate for president role** on event create/update. | WARN | P2 |
| J-M08-052 | API: GET `/org/:orgId/events` | List events with status/type/search filters | `searchEventsOptions()` with organizationId, status, eventType, q, limit params. Matches API contract. | PASS | -- |
| J-M08-053 | API: POST `/org/:orgId/events` | Create event with all fields | `createEventMutation()` via EventForm. Matches contract. | PASS | -- |
| J-M08-054 | API: POST `/org/:orgId/events/:eventId/register` | Register with personId | `registerForCustomEventMutation()`. Body shape should be verified -- UI does not explicitly pass `personId`, may auto-infer from auth. | WARN | P3 |
| J-M08-055 | API: POST `/org/:orgId/events/:eventId/checkin` | Check-in with registrationId + method | `checkInCustomEventMutation()` used in attendance page. Method (qr vs manual) not explicitly passed in body -- verify API defaults. | WARN | P3 |

---

## R6 — Cross-Module Dependency Registry

| ID | Module Pair | Integration Point | Status | Notes |
|----|-------------|-------------------|--------|-------|
| J-M08-056 | M08 -> M06 (Dues/Billing) | Paid event registration triggers Stripe checkout | PARTIAL | `registerAndPayForEventMutation()` exists. Checkout URL redirect implemented. Refund on cancellation is server-side only -- no UI feedback on refund status. |
| J-M08-057 | M08 -> M09 (Training) | Credit-bearing events award CPD credits post-event | OK | PostEventActions component has "Award Credits" with per-attendee batched mutation. Activity type selection in form. |
| J-M08-058 | M08 -> M12 (Certificates) | Generate attendance certificates post-event | OK | `bulkIssueCertificatesMutation()` in PostEventActions. Handles queued response. |
| J-M08-059 | M08 -> M07 (Communications) | Thank-you message to attendees | OK | PostEventActions has compose dialog with `createMessageMutation()` + `sendMessageMutation()`. |
| J-M08-060 | M08 -> M07 (Notifications) | Registration confirmation, waitlist promotion, event cancellation | UNVERIFIED | Server-side notification dispatch. No evidence of real-time notification handling in frontend (no WebSocket subscription for event notifications). |
| J-M08-061 | M08 -> M01 (Auth) | Officer role gating for event management | PARTIAL | Routes under `/officer/` path. Admin uses `RequireRole` HOC. No explicit 2FA enforcement for president role per spec. |

---

## Summary

| Registry | Count | Pass | Fail/Dead | Warn |
|----------|-------|------|-----------|------|
| R1 Actions | 94 | -- | -- | -- |
| R2 Journeys | 12 | 12 complete | 0 broken | 0 |
| R3 Dead Interactions | 10 | -- | 0 P1, 4 P2, 6 P3 | -- |
| R4 Orphan Actions | 9 | -- | 6 P2, 3 P3 | -- |
| R5 Spec Conformance | 24 checks | 14 PASS | 3 FAIL, 7 WARN | -- |
| R6 Cross-Module | 6 | 3 OK, 2 PARTIAL | 1 UNVERIFIED | -- |

### P1 Findings (Blockers) -- 2 total

| ID | Issue | Impact |
|----|-------|--------|
| J-M08-037 | My Events page missing QR code display for check-in | Members cannot present QR at events. Spec WF-056 explicitly requires "QR code available at /my/events". Core check-in workflow incomplete. |
| J-M08-050 | Same as J-M08-037 | Duplicate finding from R5 conformance check. |

### P2 Findings (Important) -- 8 total

| ID | Issue | Impact |
|----|-------|--------|
| J-M08-014 | My Events cancel button registrationId lookup fragile | Members may be unable to cancel registration if API field name differs. |
| J-M08-017 | Event card overflow menu has no click-outside handler | Menu stays open, confusing UX. |
| J-M08-021 | Event form allows endDate before startDate | Invalid events can be created, server must reject. |
| J-M08-022 | Post-event credit award fires 100+ parallel API calls | Performance/rate-limit risk for large events. |
| J-M08-044 | Register button visible on completed events | Members can attempt registration on completed events. Server rejects but UI should prevent. |
| J-M08-051 | No 2FA enforcement for president on event create/update | Spec requires president(2FA) for event management. |
| J-M08-023 | registerAndPayForEvent response shape unverified | Payment flow may break if API returns different structure. |
| J-M08-029 | Admin events query without org header | May return empty results or error depending on API behavior. |

### P3 Findings (Advisory) -- 12 total

| ID | Issue |
|----|-------|
| J-M08-013 | CSV export may serialize nested objects as [object Object] |
| J-M08-015 | Cancel registration ID resolution complex but defensive |
| J-M08-016 | QR scanner camera failure has no manual-entry prompt fallback |
| J-M08-018 | Discover events pricing filter may not be supported by API |
| J-M08-019 | Duplicate event capacity NaN for null values |
| J-M08-020 | Admin sheet registration query fires when sheet closed |
| J-M08-035 | Event cancellation refund status not shown to officer |
| J-M08-036 | Dashboard missing attendance summary stat per spec |
| J-M08-038 | Waitlist promotion not reflected in real-time (no polling/WS) |
| J-M08-047 | Dashboard missing attendance stats summary |
| J-M08-054 | Register API personId auto-infer vs explicit -- verify |
| J-M08-055 | Check-in API method (qr/manual) not explicitly passed |
