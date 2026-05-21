<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Screens: Events (M08)

> Tech: React 19, TanStack Router, TanStack Query, Radix UI (shadcn), Tailwind CSS, sonner toasts
> Apps: memberry (3004) for all event screens

---

## Screen 1: Events Dashboard (Officer)

**Route:** `/org/[organizationId]/officer/events`
**Purpose:** Event management: list, create, view attendance stats
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Events Management" |
| Tabs | `tablist` | "Event time range" |
| Event list | `table` | "Organization events" |
| Stats | `region` | "Event statistics" |

### Focus Management

- Page load: focus on Create Event button
- After creating event: redirect to event detail with sonner toast
- Tab switch: focus on first event in new tab
- After cancel/complete: focus on sonner toast, then list

### Fields

| Field | Type | Source | Display | Sortable | Filterable |
|-------|------|--------|---------|----------|------------|
| title | text | GET /org/:id/events | Linked title | No | Via search |
| eventType | enum | GET /org/:id/events | Type badge | No | Yes |
| status | enum | GET /org/:id/events | Status badge | No | Yes |
| visibility | enum | GET /org/:id/events | Badge | No | Yes |
| startDate | date-time | GET /org/:id/events | Formatted date | Yes (default) | Yes (date range) |
| registrationCount | integer | GET /org/:id/events | "N/[capacity]" or "N" | No | No |
| waitlistCount | integer | GET /org/:id/events | Badge if > 0 | No | No |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Create event | Button click | Navigate to /org/:id/officer/events/new | Officers | Page transition |
| View event | Row click | Navigate to event detail | Officers | Page transition |
| Filter by status | Dropdown | GET /org/:id/events?status= | Officers | List updates |
| Filter by type | Dropdown | GET /org/:id/events?eventType= | Officers | List updates |
| Switch tab (upcoming/past) | Tab click | GET /org/:id/events?from=&to= | Officers | List updates |

### Role-Variant Matrix

| Element | President | Officer | Staff | Member |
|---------|-----------|---------|-------|--------|
| View list | Yes | Yes | -- | Redirect to public events |
| Create button | Yes (2FA) | Yes | -- | -- |
| Attendance stats | Yes | Yes | -- | -- |
| Cancel event | Yes (2FA) | Yes | -- | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Full table with all columns + stats sidebar | All visible |
| 768-1023px (md) | Table with scroll, stats above | Visibility column hidden |
| < 768px (sm) | Event cards (title + date + status + count) | Tap to expand |

### Interaction States

1. **Loading:** Skeleton table (5 rows) + skeleton stats cards. `aria-busy="true"`.
2. **Empty:** "No events yet. Create your first one." Illustration + Create Event CTA.
3. **Success:** Populated table. Status badges: gray (Draft), green (Published), blue (Completed), red (Cancelled).
4. **Validation Error:** N/A for list.
5. **Permission Error:** Non-officer: redirect to `/org/[id]/events` (public list).
6. **Unexpected Error:** "Couldn't load events." + Retry.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** Cancel event: "Cancel [event title]? All registered members will be notified. Paid registrations will be refunded." [Keep Event] [Cancel Event] (red).
9. **Offline/Sync:** Cached event list shown. "You're offline." Create button disabled.

---

## Screen 2: Create/Edit Event

**Route:** `/org/[organizationId]/officer/events/new` (or `/org/[organizationId]/officer/events/[eventId]/edit`)
**Purpose:** Event creation and editing form
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Create Event" / "Edit Event" |
| Form | `form` | "Event details" |
| Capacity section | `region` | "Registration settings" |
| Fee section | `region` | "Fee settings" |

### Focus Management

- Page load: focus on title input
- After save: sonner toast, remain on form (draft) or redirect (publish)
- Validation error: focus on first invalid field

### Fields

| Field | Type | Source | Display | Validation |
|-------|------|--------|---------|------------|
| title | text | User input | Text input | Required, max 300 chars |
| eventType | enum | User input | Select dropdown | Required, 8 values |
| description | rich text | User input | Rich text editor | Optional |
| startDate | date-time | User input | Date-time picker | Required, must be future (M08-003) |
| endDate | date-time | User input | Date-time picker | Required, must be after startDate |
| location | text | User input | Text input | Optional, max 500 chars |
| coverImage | file/url | User input | Image upload | Optional, via Storage (M15) |
| visibility | enum | User input | Toggle switch | Default: internal (BR-16) |
| capacityLimit | integer | User input | Number input | Optional, positive integer. Null = unlimited |
| feeAmount | decimal | User input | Currency input | Optional, positive. Null = free |
| currency | text | User input | Dropdown | Default: PHP |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Save as draft | Button click | POST /org/:id/events or PUT /org/:id/events/:id | Officers | sonner: "Event saved as draft." |
| Publish | Button click | PUT /org/:id/events/:id/publish | Officers | sonner: "Event published! Members will be notified." |
| Upload cover | File input | POST via Storage (M15) | Officers | Image preview updates |
| Cancel (leave form) | Button/back | Navigate back | Officers | Unsaved changes warning |

### Role-Variant Matrix

| Element | President | Officer | All Others |
|---------|-----------|---------|------------|
| Full form | Yes (2FA) | Yes | 403 redirect |
| Publish | Yes (2FA) | Yes | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Two-column: details left, settings right | Cover image preview beside |
| 768-1023px (md) | Single column, sections stacked | Full-width fields |
| < 768px (sm) | Stacked, compact inputs | Date pickers use native mobile |

### Interaction States

1. **Loading:** Skeleton form (edit mode, loading existing event data).
2. **Empty (Draft):** Clean form with defaults (visibility: internal, fee: 0).
3. **Success (Saved):** sonner: "Event saved as draft." Form remains editable. sonner: "Event published!" redirects to dashboard.
4. **Validation Error:** "Title is required." "Start date must be in the future." (M08-003). "End date must be after start date." "Fee requires payment gateway configuration." Inline red borders.
5. **Permission Error:** "Creating events requires an officer role."
6. **Unexpected Error:** "Couldn't save event. Your changes are preserved." Form state kept.
7. **Conflict/Duplicate:** Edit completed event: "This event has ended. No further changes allowed." (M8-R6)
8. **Confirmation/Warning:** Publish: "Publish [title]? Members will be notified and registration will open." [Cancel] [Publish]. Leave with changes: "You have unsaved changes." [Stay] [Leave].
9. **Offline/Sync:** "Creating events requires an internet connection." Save disabled.

---

## Screen 3: Event Check-In

**Route:** `/org/[organizationId]/officer/events/[eventId]/attendance`
**Purpose:** QR scanner + manual check-in + real-time attendance
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Event Check-In" |
| Scanner | `region` | "QR Scanner" |
| Manual search | `search` | "Search attendee" |
| Attendance list | `table` | "Attendance list" |
| Stats | `status` | "Attendance count" |

### Focus Management

- Page load: activate camera for QR scanner
- After successful scan: green flash + member name + focus returns to scanner
- After failed scan: red flash + error message + focus returns to scanner
- Manual search: focus on search input
- Tab between scanner and manual search

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| attendeeList | array | GET /org/:id/events/:id/attendees | Table with check-in status | Real-time update |
| personName | text | Attendee data | Name column | -- |
| registrationStatus | enum | Attendee data | Badge | confirmed/waitlisted/cancelled/noShow |
| checkedIn | boolean | Attendee data | Checkmark icon | -- |
| checkInMethod | enum | Attendee data | Icon (QR/Manual) | -- |
| checkedInAt | date-time | Attendee data | Time | -- |
| attendanceCount | integer | Computed | Large stat | "N / [total registered]" |
| attendancePercentage | percentage | Computed | Progress bar | -- |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| QR scan | Camera detects code | POST /org/:id/events/:id/checkin {method: "qr"} | Officers | Green flash: "[Name] checked in!" |
| Manual search | Type name | Local filter on attendee list | Officers | Filtered results |
| Manual check-in | Button click | POST /org/:id/events/:id/checkin {method: "manual"} | Officers | sonner: "[Name] checked in." |
| Mark no-show | Button click | PATCH registration status | Officers | Badge updates to "No Show" |
| Filter attendees | Dropdown | GET /org/:id/events/:id/attendees?checkedIn= | Officers | List filters |

### Role-Variant Matrix

| Element | President | Officer | All Others |
|---------|-----------|---------|------------|
| Scanner access | Yes (2FA) | Yes | 403 redirect |
| Manual check-in | Yes (2FA) | Yes | -- |
| Mark no-show | Yes (2FA) | Yes | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Scanner left (40%), attendee list right (60%) | Full table |
| 768-1023px (md) | Scanner top, list below | Table scrolls |
| < 768px (sm) | Full-screen scanner with toggle to list | Optimized for handheld scanning |

### Interaction States

1. **Loading:** Skeleton list. Scanner camera loading spinner.
2. **Empty:** "No registrations yet." (event with 0 registrations)
3. **Success (Check-in):** Green flash animation with member name (1.5s). Attendance count increments. Sound feedback (optional).
4. **Validation Error (Not Registered):** Red flash: "Member not registered for this event." (M08-005). Sound: error tone.
5. **Permission Error:** "Check-in requires an officer role." (BR-17)
6. **Unexpected Error (Invalid QR):** "Invalid QR code. Try manual check-in." Red flash.
7. **Conflict/Duplicate (Already Checked In):** Blue flash: "Already checked in." (idempotent, no error). No duplicate record.
8. **Confirmation/Warning (Event Completed):** "Event check-in is closed. This event has been completed." (M8-R6). Scanner disabled.
9. **Offline/Sync:** "Check-in requires an internet connection." Scanner disabled. Cached list shown read-only.

### Validation Rules

- QR check-in: authenticated scanner + valid event + registered member (BR-18)
- Manual check-in: must select registered member
- Duplicate scan: idempotent, return success (no error)
- Event completed: all check-in actions disabled (M8-R6)

---

## Screen 4: Event Detail (Public)

**Route:** `/org/[organizationId]/events/[eventId]`
**Purpose:** Public event page for members to view details and register
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "[Event Title]" |
| Details | `region` | "Event details" |
| Registration | `region` | "Registration" |

### Focus Management

- Page load: focus on event title heading
- Register button: primary CTA, prominent focus
- After registration: focus on confirmation with QR code info

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| title | text | Event data | H1 heading | -- |
| eventType | enum | Event data | Type badge | -- |
| description | rich text | Event data | Rendered HTML | -- |
| startDate + endDate | date-time | Event data | Formatted date range | -- |
| location | text | Event data | With map icon | Link if URL |
| coverImage | image | Event data | Hero image | -- |
| capacityLimit | integer | Event data | "N spots remaining" / "Unlimited" | -- |
| feeAmount + currency | currency | Event data | "PHP 2,500" or "Free" | -- |
| registrationCount | integer | Event data | "N registered" | -- |
| waitlistCount | integer | Event data | "N on waitlist" | -- |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Register | Button click | POST /org/:id/events/:id/register | Authenticated | sonner: "Registered! Check your email for details." or redirect to payment |
| Join waitlist | Button click (at capacity) | POST /org/:id/events/:id/register | Authenticated | sonner: "Added to waitlist (position N)." |
| Cancel registration | Button click | DELETE /org/:id/events/:id/register/:regId | Self or officer | sonner: "Registration cancelled." |

### Role-Variant Matrix

| Element | Officer | Member | Non-member (internal event) |
|---------|---------|--------|---------------------------|
| View details | Full | Full | 403 (M8-R4) |
| Register | Yes | Yes | -- |
| Cancel registration | Own + others | Own only | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Hero image + details left, registration card right (sticky) | Full layout |
| 768-1023px (md) | Image above, details + registration stacked | Registration card not sticky |
| < 768px (sm) | Full-width stacked | Register button sticky bottom |

### Interaction States

1. **Loading:** Skeleton hero + detail placeholders.
2. **Empty:** N/A (event always has data if found).
3. **Success (Published):** Full details with Register button enabled. Capacity indicator.
4. **Validation Error:** N/A for read view.
5. **Permission Error (Internal):** Non-org-member for internal event: "This event is only available to organization members."
6. **Unexpected Error:** "Couldn't load event details." + Retry.
7. **Conflict/Duplicate (Full):** "Event is full." Register button changes to "Join Waitlist" with queue position info.
8. **Confirmation/Warning:** Registration for paid event: "This event has a registration fee of PHP [amount]. You'll be redirected to payment." [Cancel] [Continue to Payment]. Cancel registration: "Cancel your registration for [title]?" [Keep] [Cancel Registration].
9. **Offline/Sync:** Cached event data shown. Register button disabled. "Registration requires an internet connection."

**Additional states:**
- **Registered:** Register button replaced with "Registered" badge + QR code link + Cancel option.
- **Completed:** "This event has ended." Read-only. No registration actions.
- **Cancelled:** "This event has been cancelled." Red notice banner.

---

## Screen 5: My Events

**Route:** `/my/events`
**Purpose:** Member's registrations across all organizations
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "My Events" |
| Tabs | `tablist` | "Event time range" |
| Event list | `list` | "Registered events" |

### Focus Management

- Page load: focus on first upcoming event card
- Tab switch: focus on first event in tab
- QR code: focus on QR modal when opened

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| event.title | text | GET /my/events | Card title | Linked to event detail |
| event.eventType | enum | GET /my/events | Type badge | -- |
| event.startDate | date-time | GET /my/events | Formatted date | -- |
| event.location | text | GET /my/events | Location line | -- |
| event.organizationName | text | GET /my/events | Org badge | -- |
| status | enum | GET /my/events | Registration status badge | confirmed/waitlisted/cancelled |
| registrationId | uuid | GET /my/events | Hidden (for QR) | -- |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| View event detail | Card click | Navigate to event page | Authenticated | Page transition |
| Show QR code | QR button on card | Local render (registrationId-based) | Authenticated | QR modal opens |
| Cancel registration | Card action | DELETE /org/:id/events/:id/register/:regId | Authenticated | sonner: "Registration cancelled." |
| Switch tab | Tab click | GET /my/events?upcoming=true/false | Authenticated | List updates |

### Role-Variant Matrix

| Element | All Authenticated |
|---------|------------------|
| View own events | Yes |
| QR code | Yes (for confirmed registrations) |
| Cancel registration | Yes (if event not completed) |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | 2-column card grid | Full event cards |
| 768-1023px (md) | 2-column card grid | Slightly narrower cards |
| < 768px (sm) | Single-column card list | Compact cards, QR button prominent |

### Interaction States

1. **Loading:** Skeleton event cards (4). Tab bar enabled.
2. **Empty:** "No events yet. Browse your organization's events to get started." Link to org events.
3. **Success:** Event cards with status badges and QR buttons.
4. **Validation Error:** N/A.
5. **Permission Error:** N/A (own registrations).
6. **Unexpected Error:** "Couldn't load your events." + Retry.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** Cancel registration: "Cancel your registration for [title]?" [Keep Registration] [Cancel].
9. **Offline/Sync:** Cached event cards shown. QR codes work offline (generated client-side). Cancel disabled.

### Edge Cases

- Registration for event in another org (network event): org name shown on card
- Waitlisted registration: card shows position and "You'll be notified when a spot opens"
- Past event with noShow status: shown in Past tab with "Did Not Attend" badge
