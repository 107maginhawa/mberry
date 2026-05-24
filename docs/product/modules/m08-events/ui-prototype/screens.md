<!-- oli:ui-blueprint v2.0 | generated 2026-05-23 | source: MODULE_SPEC.md, API_CONTRACTS.md, Wave 2a design doc -->
<!-- upstream: MODULE_SPEC.md, API_CONTRACTS.md, Wave 2a design doc, ROLE_PERMISSION_MATRIX.md -->
<!-- supersedes: v1.0 (2026-05-21) — adds Wave 2a screens (public page, discovery, CPD fields, paid registration) -->

# UI Blueprint — Screens: Events (M08) — Wave 2a

> Tech: React 19, TanStack Router, TanStack Query, Radix UI (shadcn), Tailwind CSS, sonner toasts
> Apps: memberry (3004) for all event screens
> Design: Luma/Eventbrite-quality, glass morphism cards, mobile-first

---

## Screen 1: Events Dashboard (Officer)

**Route:** `/org/$orgSlug/officer/events`
**Purpose:** Officer event management — list, filter, quick actions
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Event Management" |
| Filters | `search` | "Filter events" |
| Event list | `region` | "Events" |
| Stats | `region` | "Event statistics" |

### Focus Management

- Page load: focus on search/filter bar
- After create: redirect to new event form
- After status change: sonner toast, list refreshes

### Fields

| Field | Source | Display | Notes |
|-------|--------|---------|-------|
| Title | `event.title` | Card heading, link to detail | Line-clamp 2 |
| Status | `event.status` | `EventStatusBadge` | draft/published/cancelled/completed |
| Cover image | `event.coverImageUrl` | Card hero (h-40) with date badge overlay | Fallback: no image section |
| Date | `event.startDate`, `event.endDate` | "Jun 15, 2026 · 09:00–17:00" | Locale en-PH |
| Location | `event.location` | MapPin icon + text | Fallback: "In-person" |
| Price | `event.registrationFee`, `event.currency` | `PriceBadge` | "Free" or "PHP 500" |
| CPD hours | `event.creditAmount` | `CpdBadge` | Only if creditBearing=true |
| Registration count | computed | "5 / 100 registered" | Users icon |
| Visibility | `event.visibility` | Label in badge row | Map internal→"Members Only", network→"Public" |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Create event | Button click | Navigate to `/officer/events/new` | Officers | Page transition |
| View event | Card click | Navigate to event detail | Officers | Page transition |
| Filter by status | Dropdown | `searchEvents({ status })` | Officers | List updates |
| Filter by type | Dropdown | `searchEvents({ eventType })` | Officers | List updates |
| Publish | Quick action menu | `POST /{eventId}/publish` | Officers | sonner: "Event published" |
| Cancel | Quick action menu | `POST /{eventId}/cancel` | Officers | Confirm dialog → sonner |
| Duplicate | Quick action menu | Navigate to new form with prefill | Officers | Page transition |

### Role-Variant Matrix

| Element | Officer | Member | Unauthenticated |
|---------|---------|--------|-----------------|
| Dashboard | Full CRUD | Not accessible | Not accessible |
| Create button | Visible | Hidden | N/A |
| Quick actions | Visible | Hidden | N/A |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | 3-column card grid | Full cards with cover images |
| 768-1023px (md) | 2-column card grid | Slightly narrower |
| < 768px (sm) | Single column | Stack cards, compact layout |

---

## Screen 2: Create/Edit Event

**Route:** `/org/$orgSlug/officer/events/new` (create), `/org/$orgSlug/officer/events/$eventId` (edit)
**Purpose:** Event creation form with CPD config, pricing, cover image
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Create Event" / "Edit Event" |
| Form | `form` | "Event details" |
| Cover section | `region` | "Cover image" |
| CPD section | `region` | "CPD credits" |
| Registration section | `region` | "Registration settings" |

### Focus Management

- Page load: focus on title input
- Validation error: focus first invalid field
- Save success: redirect to event detail, sonner toast
- Publish: if paid event + no Stripe, block with "Set up billing" prompt

### Fields

| Field | Type | Validation | Default | Notes |
|-------|------|------------|---------|-------|
| Cover image URL | text input | optional, max 2048 chars | — | Upload via Storage module, paste URL. Future: drag-drop component |
| Title | text | required, 1-200 chars | — | Auto-generates slug on first save (immutable after) |
| Event type | select | required | "other" | 8 types: GA, ceremony, fellowship, mission, board, committee, fundraiser, other |
| Description | textarea | optional, max 10000 chars | — | 4 rows |
| Start date/time | datetime | required | — | DateTimePicker component |
| End date/time | datetime | required, after start | — | DateTimePicker component |
| Location | text | optional | — | Venue name or virtual URL |
| **CPD Credits toggle** | switch | — | false | Shows/hides CPD fields below |
| CPD activity type | select | required if CPD on | — | 10 types: seminar, workshop, conference, webinar, hands_on, community, research, mentorship, self_directed, other |
| Credit hours | number | 0.5 increments, max 40 | 0 | Step=0.5, min=0.5 when CPD on |
| Registration fee | number | >= 0 | 0 | Display currency, stored as cents. 0 = Free |
| Capacity | number | optional, >= 1 | unlimited | Leave blank = unlimited |
| Visibility | select | required | "internal" | "Members Only" (internal) / "Public" (network) |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Save Draft | Submit button | `createEvent()` / `updateEvent()` | Officers | sonner: "Draft saved" |
| Publish | Publish button | create then `publishEvent()` | Officers | sonner: "Event published" |
| Publish guard | Publish paid event | Check org Stripe account | Officers | Block: "Set up billing to charge for events" |
| Cancel form | Cancel button | Navigate back | Officers | No save |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 768px | 2-column grid for date fields | Side-by-side start/end |
| < 768px | Single column | All fields stacked |

---

## Screen 3: Event Check-In (Officer)

**Route:** `/org/$orgSlug/officer/events/$eventId/attendance`
**Purpose:** Manual name lookup (primary) + QR scanner (enhancement) + real-time attendance
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Event Check-In" |
| Search | `search` | "Search attendees" |
| Scanner | `region` | "QR Scanner" |
| Attendance list | `region` | "Attendance" |
| Stats | `region` | "Attendance statistics" |

### Focus Management

- Page load: focus on manual search input (primary path)
- QR scanner: behind toggle/expandable panel, camera permission prompt on activate
- After successful check-in: green flash + member name animation, focus returns to search
- After failed check-in: red flash + error message, focus returns to search
- Event completed: all check-in actions disabled, "Event completed — check-in locked" banner

### Fields

| Field | Source | Display | Notes |
|-------|--------|---------|-------|
| Attendance counter | computed | "42 / 100 checked in (42%)" | `AttendanceCounter` with progress bar |
| Search input | user input | Name/email autocomplete | Filters registered attendees |
| Attendee list | `GET /{eventId}/attendance` | Table: name, reg status, check-in time, method badge | Sort by name default |
| QR scanner | camera | `html5-qrcode` in expandable panel | Optional — manual is primary |
| Check-in confirmation | animation | Green flash with member name + "✓" | 2s duration |
| Attestation | auto | Hidden JSONB — officerId, method, deviceInfo, timestamp | Compliance record |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Manual search | Type name | Client-side filter on registered list | Officers | Filtered results |
| Manual check-in | "Check In" button next to name | `POST /checkin { method: "manual" }` | Officers | Green flash: "[Name] ✓" |
| QR scan | Camera detects code | `POST /checkin { method: "qr" }` | Officers | Green flash: "[Name] ✓" |
| Toggle QR scanner | "Open Scanner" button | — | Officers | Camera panel expands |
| Mark no-show | Button | PATCH registration status | Officers | Badge → "No Show" |

### Validation Rules

| Rule | Error | Recovery |
|------|-------|----------|
| Already checked in | ConflictError | Flash shows existing check-in time |
| Not registered | NotFoundError | Prompt to register first |
| Event completed [M8-R6] | BusinessLogicError | All actions disabled, banner |
| Invalid QR | Error | Red flash, retry from search |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px | Search + scanner left, attendee list right | Side-by-side |
| < 1024px | Search on top, list below | QR scanner in expandable panel |

---

## Screen 4: Event Detail (Member)

**Route:** `/org/$orgSlug/events/$eventId`
**Purpose:** Member-facing event detail with registration, payment, calendar download
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "[Event Title]" |
| Cover | `img` | "Event cover image" |
| Badges | `region` | "Event badges" |
| Details | `region` | "Event details" |
| Registration | `region` | "Registration" |

### Focus Management

- Page load: scroll to register button
- After register: show "Add to Calendar" button, focus on it
- After cancel: confirmation, focus returns to register button
- Payment return: `?payment=success` → sonner "Payment confirmed!", `?payment=cancelled` → sonner "Payment not completed"

### Fields

| Field | Source | Display | Notes |
|-------|--------|---------|-------|
| Cover image | `event.coverImageUrl` | Hero banner (h-48 sm:h-64, rounded-xl) | Full-width, omit if null |
| Title | `event.title` | PageHeader h1 | — |
| Status | `event.status` | Subtitle | — |
| Price badge | `event.registrationFee` | "Free" (green) or "PHP 500" (neutral) | DollarSign icon |
| CPD badge | `event.creditAmount` | "4 CPD hours" + "(pending check-in)" if registered | Award icon, primary color |
| Start | `event.startDate` | Full locale with weekday | Calendar icon |
| End | `event.endDate` | Full locale | Clock icon |
| Location | `event.location` | Text | MapPin icon |
| Capacity | computed | "N of M spots remaining" with CountUp | Users icon |
| Description | `event.description` | Whitespace-pre-wrap | — |

### Actions

| Action | Trigger | Condition | API Call | Feedback |
|--------|---------|-----------|----------|----------|
| Register (free) | "Register" button | Free + not full | `registerForCustomEvent()` | sonner: "Registered!" |
| Register & Pay | "Register and Pay" button | Paid + not full | `registerAndPayForEvent()` | Redirect to Stripe Checkout |
| Join Waitlist | "Join Waitlist" button | At capacity | `registerForCustomEvent()` | sonner: "Added to waitlist" |
| Add to Calendar | CalendarPlus button | Registered | Client-side .ics download | File download |
| Cancel | "Cancel Registration" button | Registered/waitlisted | `cancelEventRegistration()` | sonner: "Cancelled" |

### Role-Variant Matrix

| Element | Registered Member | Unregistered Member | Non-Member (public) |
|---------|-------------------|---------------------|---------------------|
| Event details | Full view | Full view | Full view |
| Register button | Hidden (show status card) | Visible | "Join [Org] to register" CTA |
| Cancel button | Visible | Hidden | Hidden |
| Add to Calendar | Visible | Hidden | Hidden |
| CPD badge | "pending check-in" suffix | Hours only | Hours only |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Cover hero, details + registration side-by-side | Registration card sticky |
| 768-1023px (md) | Cover above, stacked below | — |
| < 768px (sm) | Full-width stacked | Register button sticky bottom bar |

---

## Screen 5: Public Event Page (Unauthenticated)

**Route:** `/events/$eventSlug` (needs new route — currently only OG meta at `/og/events/:slug`)
**Purpose:** Shareable event page for WhatsApp/Facebook. No auth required.
**App:** memberry (3004)
**Status:** **NOT YET IMPLEMENTED** — needs frontend route

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "[Event Title]" |
| Details | `region` | "Event information" |
| CTA | `region` | "Registration" |

### Fields

Same as Screen 4 but sourced from `getPublicEvent({ slug })` — no auth header.

### Actions

| Action | Trigger | Condition | Feedback |
|--------|---------|-----------|----------|
| Join to register | "Join [Org Name] to register" CTA | Not authenticated | Navigate to `/join` or `/invite/$token` |
| Sign in | "Sign in to register" link | Has account but not logged in | Navigate to `/auth/sign-in?redirect=/events/$slug` |

### OG Meta (served by `/og/events/:slug` backend route)

```html
<meta property="og:title" content="[Event Title]" />
<meta property="og:description" content="[Location] | [Date] | [CPD hours]" />
<meta property="og:image" content="[coverImageUrl]" />
```

### States

| State | Display |
|-------|---------|
| Published/Registration Open | Full details + CTA |
| Completed | Read-only + "This event has ended" banner |
| Draft/Cancelled | 404 |

---

## Screen 6: My Events

**Route:** `/my/events`
**Purpose:** Member's registered events across all organizations
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "My Events" |
| Stats | `region` | "Event statistics" |
| Filter | `tablist` | "View filter" |
| Event list | `region` | "Your events" |

### Fields

| Field | Source | Display | Notes |
|-------|--------|---------|-------|
| Upcoming count | computed | CountUp stat card | — |
| Past count | computed | CountUp stat card | — |
| Registration status | `registration.status` | `RegistrationStatusBadge` | confirmed/waitlisted/cancelled |
| CPD hours | `event.creditAmount` | Badge: "4 CPD (pending check-in)" if upcoming | Award icon, primary color |
| Event title | `event.title` | Card heading, link to detail | — |
| Date | `event.startDate` | Locale format | Calendar icon |
| Location | `event.location` | Text | Building icon |
| Countdown | computed | "In 3 days" / "Tomorrow" / "Today" | Upcoming only |
| Attendance | `registration.checkedIn` | "Attended" / "Did not attend" / "Not recorded" | Past only |

### Actions

| Action | Trigger | API Call | Feedback |
|--------|---------|----------|----------|
| Toggle upcoming/all | Tab buttons | Client-side filter | List updates |
| View event | Card click | Navigate to event detail | Page transition |
| Cancel registration | Cancel button | `cancelEventRegistration()` | sonner: "Cancelled" |
| Add to Calendar | Button | Client-side .ics download | File download |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | 3-column card grid | Full cards |
| 768-1023px (md) | 2-column card grid | — |
| < 768px (sm) | Single column | Compact cards |

---

## Screen 7: Discover Events (Public)

**Route:** `/discover/events`
**Purpose:** Cross-org public event discovery with filters
**App:** memberry (3004)
**Status:** **Implemented**

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Discover Events" |
| Filters | `search` | "Filter events" |
| Results | `region` | "Public events" |

### Fields

| Field | Source | Display | Notes |
|-------|--------|---------|-------|
| Search | user input | Input with Search icon, pl-9 | Keyword in title |
| Event type | select | "All Types", Seminar, Social, Fundraiser, Governance, Custom | — |
| Pricing | select | All, Free, Paid | — |
| Event cards | `listPublicEvents()` | `PublicEventCard` in StaggerGrid | Cover, title, date, location, price, CPD |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | 3-column card grid | Full cards with covers |
| 768-1023px (md) | 2-column card grid | — |
| < 768px (sm) | Single column | Stacked cards |

---

## Screen Inventory — Implementation Status

| # | Screen | Route | Status | Gap |
|---|--------|-------|--------|-----|
| 1 | Events Dashboard | `/officer/events` | ✅ Upgraded | — |
| 2 | Create/Edit Event | `/officer/events/new` | ✅ Upgraded | Image upload is URL-only (no drag-drop) |
| 3 | Event Check-In | `/officer/events/$id/attendance` | ⚠️ Backend ready | **Frontend scanner UI not built** |
| 4 | Event Detail (Member) | `/events/$eventId` | ✅ Upgraded | — |
| 5 | Public Event Page | `/events/$eventSlug` | ❌ Missing | **Needs unauthenticated frontend route** |
| 6 | My Events | `/my/events` | ✅ Upgraded | — |
| 7 | Discover Events | `/discover/events` | ✅ Implemented | — |
