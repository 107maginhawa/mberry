# Module 8: Events

## Overview

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Social, governance, and community activities. Events are non-credit-bearing activities that bring members together for assemblies, ceremonies, outreach, fundraising, and meetings. Includes event creation, registration with optional payment, QR-based attendance check-in, waitlisting, and public event pages. |
| **Phase** | 1 |
| **Monetization Tier** | Premium |
| **Dependencies** | M05 (Membership) -- events are scoped to org members; registration requires active membership. M07 (Communications) -- event creation triggers notifications to members; event sharing uses the activity feed and notification system. M06 (Dues & Payments) -- paid event registration requires payment processing through the org's configured gateway. |

---

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 8.1 | Event creation | Officer creates an event: title, type (select from 8 platform-defined types), description (rich text), date/time (start + end), location (venue name + address or "Online" + meeting link), cover image. Events do NOT carry credit value. | Officer (Secretary) | P1 |
| 8.2 | Event editing and cancellation | Officer edits event details before or after publishing. Can cancel an event -- all registered members are notified. Cancelled events remain visible (strikethrough styling) for record-keeping. Cancelled events cannot accept new registrations. | Officer | P1 |
| 8.3 | Optional registration | Officer can enable registration for an event. If enabled: members click "Register", registration count is visible, officer sees attendee list. If paid: member pays fee through org gateway before registration is confirmed. If registration disabled: event is informational only. | Member, Officer | P1 |
| 8.4 | Registration cap and waitlist | Officer can set a maximum registration count. When cap is reached, new registrants join a waitlist. When a registered member cancels, the first waitlisted member is auto-promoted and notified. Waitlist position is visible to the member. | Member, Officer | P1 |
| 8.5 | QR attendance check-in | Officer uses QR scanner on their phone to check in attendees. QR code displayed by member rotates every 60 seconds (TOTP-like mechanism). Offline-capable: check-ins stored locally and synced on reconnect. Validation window: current rotation period plus/minus 1 period. Clock skew tolerance: 30 seconds. | Officer, Member | P1 |
| 8.6 | Manual attendance check-in | Officer marks members as present from the attendee list (fallback when QR is impractical). Searches by name or license number. Duplicate check-in prevention: system warns if member is already checked in. | Officer | P1 |
| 8.7 | Event sharing (visibility) | Events are internal by default (only visible to hosting org's members). Officer can toggle "Share to network" to make the event visible to members of other orgs in the same association. Shared events appear in other orgs' activity feeds (subject to their sharing preferences per M04 capability 4.11). | Officer | P1 |
| 8.8 | Public event page | Public URL for events marked as public (shareable for recruitment/promotion). Shows event details, date, location, cover image, and a "Register" button (requires login/registration). No login required to view. SEO-friendly. | Public visitor, Member | P1 |
| 8.9 | Event attendance reporting | Officer views attendance report: total registered, total checked in, check-in method (QR vs manual), check-in timestamps. Exportable as CSV. | Officer | P1 |

---

## Event Types

The platform defines 8 event types. These are fixed at the platform level and cannot be customized by individual organizations. Consistency across the network enables meaningful cross-org reporting.

| # | Type | Typical Use |
|---|------|-------------|
| 1 | General Assembly | Annual or quarterly membership meeting |
| 2 | Induction Ceremony | New member or new officer installation ceremony |
| 3 | Fellowship / Social | Dinners, mixers, holiday parties, networking events |
| 4 | Medical/Dental Mission | Community outreach, volunteer medical/dental services |
| 5 | Board Meeting | Internal officer or board-level meetings |
| 6 | Committee Meeting | Committee-level working meetings |
| 7 | Fundraiser | Charity events, auctions, benefit activities |
| 8 | Other | Any event not fitting the above categories |

---

## User Journeys

### CS-3: Create and Publish Event

| Attribute | Detail |
|-----------|--------|
| **Actor** | Chapter Secretary (or any officer with event management permission) |
| **Trigger** | Secretary needs to create an upcoming org event (assembly, social, mission, etc.). |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "Events" from sidebar | Events dashboard: list of upcoming, past, and draft events | |
| 2 | Clicks "New Event" | Event creation form | |
| 3 | Selects event type | Picks from 8 platform-defined types via dropdown | |
| 4 | Fills in details | Title (required), description (rich text editor), date/time start and end (required), location: venue name + address OR "Online" toggle + meeting link. Cover image upload (optional, max 5 MB, JPEG/PNG/WebP). | Missing required fields -> inline validation errors. End time before start time -> "End time must be after start time." |
| 5 | Configures registration | Toggle: "Enable registration?" If yes: free or paid? If paid: fee amount (required). Capacity limit? If yes: max registrants (number input). | Paid registration but no payment gateway configured -> "Connect your payment gateway first in Org Settings." |
| 6 | Configures attendance tracking | Toggle: "Enable QR check-in?" If enabled, QR scanner will be available on the event check-in page. Manual check-in is always available regardless. | |
| 7 | Sets visibility | Internal (default) or "Share to network." If shared, toggle for "Public page" (generates shareable URL). | |
| 8 | Previews event | Full preview of event detail page as members will see it | |
| 9 | Publishes event | Event appears in org activity feed. Notification sent to members (in-app, push/email per preferences). If shared: appears in network feeds. Confirmation: "Event published successfully." | Publish fails -> "Failed to publish. Your draft has been saved. Try again." |

**Success criteria:** Event appears in members' activity feeds within 30 seconds of publishing. Notification delivered per member preferences.

---

### CS-4: Check In Attendees at Event

| Attribute | Detail |
|-----------|--------|
| **Actor** | Chapter Secretary or designated officer at the event venue |
| **Trigger** | Event day -- officer needs to record member attendance. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens event detail -> clicks "Check-in" | Check-in screen with two modes: "QR Scanner" and "Manual" tabs. Attendance counter: "0 / N checked in" (where N = registered count). | |
| 2a | **QR Scanner mode:** Activates camera | Camera viewfinder with QR scan overlay. Instructions: "Point camera at member's QR code." | Camera permission denied -> prompt to enable, fallback to manual mode. |
| 2b | Scans member's rotating QR code | System validates: (1) HMAC signature valid, (2) QR rotation period within window (current +/- 1 period, 30s clock skew tolerance), (3) member is registered for this event (or is an org member if no registration required). | Invalid/modified QR -> "Invalid code. Check-in rejected." Expired QR rotation -> "Code expired. Ask member to refresh." Member not registered -> "Not registered for this event." |
| 3 | Attendance confirmed | Member name + photo displayed. "Checked in." sound/haptic feedback. Attendance counter increments. | Already checked in -> "Already recorded at [time]. No duplicate." |
| 4a | **Manual mode:** Searches member by name or license# | Filtered list of registered/eligible members with check-in status | No results -> "Member not found. Check spelling or verify registration." |
| 4b | Taps "Check in" next to member name | Confirmation: "Check in [Name]?" -> Confirm | Already checked in -> "Already recorded." |
| 5 | Views live attendance list | Real-time list of checked-in members with timestamps, sorted by check-in time. Shows checked-in / total counts. | |
| 6 | **Offline scenario:** Device loses connectivity | Check-ins stored locally. Banner: "Offline -- check-ins will sync when connected." QR validation uses cached HMAC key. | Sync conflict on reconnect -> last-write-wins with conflict log for officer review. |
| 7 | Device reconnects | Queued check-ins sync to server. Banner: "Synced N check-ins." | Sync fails -> retry automatically. "N check-ins pending sync." |

**Success criteria:** QR check-in completes in under 2 seconds (scan to confirmation). Offline check-ins sync within 30 seconds of reconnection. No duplicate attendance records created.

---

### M-17: Browse and Register for Events

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member wants to find and register for upcoming events. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens activity feed or navigates to "Events" tab | List of upcoming events: own org events + network-shared events (per org sharing preferences). Each card shows: event type icon, title, date, location, registration status (Open/Full/Closed), fee (if paid). | No upcoming events -> "No upcoming events. Check back later." |
| 2 | Filters events | Filter by: type (dropdown of 8 types), date range, org (if multi-org member), free/paid | No results -> "No events match your filters." |
| 3 | Taps event card | Event detail page: full description, date/time, location/map link, cover image, registration count ("35 of 50 spots"), organizer info. | |
| 4a | Clicks "Register" (free event) | Instant confirmation: "You're registered! Added to your calendar." Option to add to device calendar (ICS download). | Already registered -> "You're already registered." Capacity full -> "Event is full. Join waitlist?" |
| 4b | Clicks "Register" (paid event) | Redirected to payment checkout (org's gateway). Amount pre-filled. | Gateway unavailable -> "Online payment unavailable. Contact treasurer for manual registration." Payment fails -> "Payment failed. Try again." |
| 5 | Payment completes (paid event) | Webhook confirms payment. Registration confirmed. Receipt generated. "Registration confirmed! Receipt sent to your email." | Webhook delay -> "Payment processing... We'll confirm shortly." |
| 6 | Capacity full -> joins waitlist | "You're #3 on the waitlist. We'll notify you if a spot opens." | |
| 7 | Waitlist promotion | Registered member cancels -> first waitlisted member auto-promoted. Notification: "A spot opened! You're now registered for [Event]." If paid: "A spot opened! Complete payment to confirm." | Promoted member does not pay within 24 hours -> spot offered to next waitlisted member. |

**Success criteria:** Free registration completes in under 1 second. Paid registration completes within standard payment gateway flow time. Waitlist promotion notification sent within 60 seconds of a cancellation.

---

### M-18: View My Event Registrations and Check-in QR

| Attribute | Detail |
|-----------|--------|
| **Actor** | Member |
| **Trigger** | Member wants to view their upcoming event registrations or display their check-in QR code at an event. |

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens "My Events" from dashboard or profile | List of registered events grouped by: Upcoming / Past. Each shows: title, date, location, registration status (Registered/Waitlisted/Checked In), payment status (if paid). | No registrations -> "You haven't registered for any events yet." with link to browse events. |
| 2 | Taps an upcoming event | Event detail with personal registration info: registration date, payment receipt (if paid), waitlist position (if waitlisted). | |
| 3 | Event day: taps "Show QR Code" | Full-screen QR code for check-in. QR rotates every 60 seconds (TOTP-like). Countdown timer shows seconds until next rotation. Instructions: "Show this to the event officer for check-in." | Device clock significantly out of sync -> "Your device clock may be incorrect. QR validation may fail." |
| 4 | After check-in | Registration status updates to "Checked In" with timestamp. | |
| 5 | Cancels registration | "Cancel registration?" confirmation dialog. If paid: "Refund policy: [org policy]." Cancellation confirmed. If waitlist exists: next waitlisted member auto-promoted. | Cannot cancel after event date has passed. |

**Success criteria:** QR code generates and rotates without network connectivity (TOTP is client-side). Registration status reflects check-in within 5 seconds.

---

## Business Rules

### Referenced Business Rules

| Rule ID | Summary | Relevance to This Module |
|---------|---------|--------------------------|
| BR-15 | Training vs Event Distinction | Events do NOT award credits. BR-15 defines that events and trainings are distinct activity types; only trainings generate CreditEntry records. Events are explicitly excluded from credit generation. |
| BR-16 | Activity Visibility | Events default to internal (org-only) visibility. Officer can toggle to network-wide before or after publishing. This is the platform default for event visibility per BR-16. |
| BR-20 | Certificate Generation | Does not apply to events. Certificates are generated only after attendance is confirmed for credit-bearing activities. Since events are non-credit-bearing (per BR-15), certificates are N/A for events. |
| BR-27 | Event Registration Limits | Capacity enforcement at registration time; waitlist activated when capacity reached |

### Module-Specific Rules

| Rule ID | Rule | Category |
|---------|------|----------|
| M8-R1 | **Events do not generate credits.** No credit entries (AUTO or MANUAL) are created from event attendance. Credit tracking is exclusively a Training (M09) and Credit Tracking (M10) concern. Event check-in records attendance for reporting purposes only. | Constraint |
| M8-R2 | **Platform-defined event types are immutable.** The 8 event types are defined at the platform level. Organizations cannot add, remove, or rename types. This ensures consistency for cross-org reporting and analytics. | Constraint |
| M8-R3 | **QR rotation period: 60 seconds.** The member's check-in QR code regenerates every 60 seconds using a TOTP-like mechanism. The validation window accepts the current code, the immediately preceding code, and the immediately following code (3 valid codes at any moment). Clock skew tolerance: 30 seconds. This prevents QR sharing (screenshots become invalid quickly) while accommodating minor device clock differences. | Time-based |
| M8-R4 | **Offline check-in with sync.** When the officer's device is offline, QR check-ins are validated locally using a cached HMAC key and stored in local storage. On reconnection, queued check-ins sync to the server. Conflict resolution: if the same member was checked in both offline and online (by another officer), the earliest timestamp wins and no duplicate is created. | Constraint |
| M8-R5 | **Waitlist auto-promotion.** When a registered member cancels and a waitlist exists, the first waitlisted member (by waitlist join time) is automatically promoted. For free events: promotion is instant and notification sent. For paid events: promoted member receives a notification with a payment link and has 24 hours to complete payment. If not paid within 24 hours, the spot is offered to the next waitlisted member. | Time-based |
| M8-R6 | **Cancelled events are preserved.** Cancelled events are not deleted. They remain visible in the events list with "Cancelled" status and strikethrough styling. All registration data is preserved. Registered members are notified of cancellation. Paid registrations trigger refund workflow (handled by M06). | Constraint |
| M8-R7 | **Paid registration requires confirmed payment.** For paid events, a member's registration is not confirmed until payment is successfully processed (webhook received). Pending payments show as "Registration Pending Payment." If payment is not completed within 24 hours, the pending registration is cancelled and the spot is released. | Constraint |
| M8-R8 | **Public event page access.** Public event pages (`/org/[id]/events/[id]`) are accessible without authentication. They display: event title, type, description, date/time, location, cover image, hosting org name and logo, registration count (if enabled). The "Register" button requires authentication (redirects to login/register if not logged in). | Access / UX |
| M8-R9 | **Duplicate check-in prevention.** The same member cannot be checked in twice for the same event. A second QR scan or manual check-in attempt for an already-checked-in member is rejected with a notification ("Already recorded at [time]"). No duplicate EventAttendance records are created. | Constraint |

---

## UX Specification

### Screen Inventory

| Route | Page Name | Description | Desktop | Mobile |
|-------|-----------|-------------|---------|--------|
| `/org/[id]/officer/events` | Events Dashboard (Officer) | List of all org events: upcoming, past, drafts, cancelled. Filters and search. | Sidebar + main content area with table/card view | Full-width card list |
| `/org/[id]/officer/events/new` | Create Event | Event creation form with type selector, rich text description, date/time, location, registration config, visibility | Multi-section form with live preview | Single-column stepped form |
| `/org/[id]/officer/events/[id]` | Event Detail (Officer) | Full event info + registration list + attendance stats + edit/cancel actions | Main content + side panel with stats | Full-width with tabs (Details / Registrations / Attendance) |
| `/org/[id]/officer/events/[id]/attendance` | Event Check-in | QR scanner + manual check-in + live attendance counter | Split: scanner left, attendance list right | Full-screen scanner with attendance drawer |
| `/org/[id]/events/[id]` | Public Event Page | Public-facing event detail with Register button. No auth required to view. | Centered content, max-width 720px | Full-width responsive |
| `/my/events` | My Events (Member) | Member's registered events: upcoming, past, waitlisted | Card list grouped by status | Card list grouped by status |

### Screen Details

#### Events Dashboard (`/org/[id]/officer/events`)

**Layout:**
- Header: "Events" title + "New Event" primary button
- Filter bar: Status tabs (Upcoming / Past / Drafts / Cancelled), Type filter dropdown, Date range, Search
- Event list: Card view (default) or table view toggle

**Components:**
- Event card: Cover image thumbnail, title, type badge, date/time, location, registration count ("35/50"), status badge (Published/Draft/Cancelled), visibility badge (Internal/Network)
- Quick actions per card: Edit, Cancel, View Check-in (if event day), Duplicate
- Stats summary: Total events this month, total registrations, average attendance rate

**States:**
- Loading: Skeleton cards
- Empty: "No events yet. Create your first event to engage your members." + "New Event" CTA
- Populated: Paginated (20 per page)
- Error: "Failed to load events. Retry."

#### Create Event (`/org/[id]/officer/events/new`)

**Layout:**
- Desktop: Multi-section form. Sections: Basic Info, Date & Location, Registration, Visibility.
- Mobile: Stepped form (one section per step) with progress indicator.

**Components:**
- Type selector: Dropdown with 8 platform-defined types. Icon + label per type.
- Title input: Required, max 200 characters.
- Description: Rich text editor (Tiptap). Same capabilities as announcement editor.
- Date/time: Start date + time, End date + time. Date picker + time picker. Timezone shown.
- Location: Radio -- "In-person" (venue name + address text fields) or "Online" (meeting link URL field).
- Cover image: Drag-and-drop upload, max 5 MB, JPEG/PNG/WebP. Crop to 16:9 aspect ratio.
- Registration toggle: On/off. If on: Free/Paid radio. If paid: fee amount input (currency from org locale). Capacity limit toggle: if on, max registrants number input.
- Attendance tracking toggle: On/off for QR check-in.
- Visibility: Internal (default) / Network-wide. If network-wide: additional toggle for "Public page" (generates shareable URL).
- Action buttons: "Save Draft", "Publish"

**States:**
- Empty form: All fields empty with placeholder text
- Validation errors: Inline error messages per field
- Submitting: Loading spinner on action button
- Success: Redirect to event detail with success toast

#### Event Check-in (`/org/[id]/officer/events/[id]/attendance`)

**Layout:**
- Desktop: Two columns. Left: QR scanner (camera viewfinder) or manual search. Right: live attendance list.
- Mobile: Full-screen QR scanner with bottom drawer for attendance list. Tab to switch to manual mode.

**Components:**
- QR scanner: Camera viewfinder with scan overlay. Success: green flash + member name + photo. Failure: red flash + error message.
- Manual check-in: Search bar (name or license#) + filtered member list with "Check in" button per row.
- Attendance counter: Prominent display -- "23 / 50 checked in" with progress bar.
- Attendance list: Scrollable list of checked-in members with timestamp and method (QR/Manual).
- Offline indicator: Yellow banner "Offline -- check-ins will sync when connected. N pending."

**States:**
- Pre-event: "Check-in opens on [event date]." (if accessed before event day)
- Active check-in: Scanner ready, counter at 0
- In-progress: Counter incrementing, list populating
- Offline: Yellow banner, check-ins queued locally
- Reconnected: "Synced N check-ins." success message
- Post-event: Check-in still accessible for late entries. "Event ended. Late check-in mode."

#### Public Event Page (`/org/[id]/events/[id]`)

**Layout:**
- Centered single-column, max-width 720px
- Cover image hero (full width)
- Event info below

**Components:**
- Cover image: Full-width hero, 16:9 aspect
- Event type badge
- Title (h1)
- Date/time with timezone
- Location with map link (if in-person) or "Online Event" label
- Description (rich text rendered)
- Hosting org: Name + logo + link to org public page
- Registration section: "Register" primary button. If capacity: "X of Y spots remaining." If full: "Event is full. Join waitlist." If closed: "Registration closed."
- Login gate: "Register" button redirects to login if not authenticated, then back to this page.

**States:**
- Open registration: Green "Register" button, spots available count
- Full with waitlist: Orange "Join Waitlist" button, position info
- Registration closed: Grey "Closed" label
- Cancelled: "This event has been cancelled" banner, registration disabled
- Past event: "This event has ended" banner, no registration

#### My Events (`/my/events`)

**Layout:**
- Grouped sections: Upcoming, Waitlisted, Past
- Card list within each section

**Components:**
- Event card: Title, date, location, registration status badge (Registered/Waitlisted/Checked In), payment status (if paid: Paid/Pending), "Show QR" button (for upcoming, registered events on event day)
- QR display: Full-screen overlay with rotating QR code, countdown timer, close button
- Cancel registration: "Cancel" link with confirmation dialog

**States:**
- No registrations: "You haven't registered for any events. Browse upcoming events." + link to activity feed
- Upcoming events present: Cards with "Show QR" for today's events
- Past events: Cards with "Checked In" or "Missed" status

### Empty States

| Screen | Empty State Message | CTA |
|--------|-------------------|-----|
| Events Dashboard (Officer) | "No events yet. Create your first event to bring your members together." | "Create Event" button |
| My Events (Member) | "You haven't registered for any events. Discover upcoming events in your activity feed." | "Browse Events" link |
| Check-in Attendance List | "No one has checked in yet. Start scanning member QR codes or use manual check-in." | None (scanner is active) |
| Public Event Page (no upcoming public events) | "No public events at this time." | Link to org public page |

### Error States

| Screen | Error Condition | Message | Recovery |
|--------|----------------|---------|----------|
| Create Event | Cover image upload fails | "Image upload failed. Max 5 MB, JPEG/PNG/WebP only." | Retry upload |
| Create Event | Paid event, no gateway | "Online payment is not configured. Set up your payment gateway in Org Settings to accept paid registrations." | Link to Org Settings -> Payment Gateway |
| Registration | Payment fails | "Payment failed. Please try again or use a different payment method." | Retry payment |
| Registration | Capacity reached | "This event is full. Would you like to join the waitlist?" | "Join Waitlist" button |
| QR Check-in | Camera permission denied | "Camera access is required for QR scanning. Please enable camera permission in your device settings." | Link to device settings + "Use Manual Check-in" fallback |
| QR Check-in | Invalid QR code | "Invalid code. This QR code is not recognized. Ask the member to refresh their code." | Member refreshes QR on their device |
| QR Check-in | Member not registered | "This member is not registered for this event." | Officer can manually add and check in |
| Offline Check-in | Sync fails on reconnect | "N check-ins pending sync. Will retry automatically." | Auto-retry every 30 seconds |

---

## Acceptance Criteria Patterns

- Event types are platform-defined (8 types) and cannot be customized by organizations.
- Events do NOT award credits. No credit entries are created from event attendance. This is verified by confirming the absence of any CreditEntry records linked to event check-ins.
- QR code for attendance rotates every 60 seconds. A screenshot taken at T=0 is invalid at T=121 seconds (outside the +/- 1 rotation window).
- QR check-in validates HMAC signature before accepting. Modified QR payloads are rejected.
- Offline check-ins are stored locally and sync within 30 seconds of reconnection. No duplicates created.
- Paid event registration is only confirmed after successful payment (webhook received).
- Waitlist auto-promotes the earliest waitlisted member when a spot opens. For paid events, promoted member has 24 hours to pay.
- Cancelled events remain visible with "Cancelled" status. Registered members are notified within 5 minutes.
- Public event page is accessible without authentication. Register button requires login.
- Registration capacity is enforced: no more than N confirmed registrations when cap is set to N.
- Event detail page loads within 2 seconds.
- Check-in screen processes QR scans in under 2 seconds (scan to confirmation).

---

## Data Entities

| Entity | Description | Key Fields | Relationships |
|--------|-------------|------------|---------------|
| **Event** | A social, governance, or community activity created by an officer. Does not carry credit value. | `id`, `org_id`, `created_by`, `title`, `type` (enum: 8 platform types), `description_html`, `description_text`, `start_date`, `end_date`, `location_type` (in_person/online), `venue_name`, `venue_address`, `online_link`, `cover_image_url`, `registration_enabled`, `registration_type` (free/paid), `fee_amount`, `fee_currency`, `capacity_limit`, `qr_checkin_enabled`, `visibility` (internal/network), `public_page_enabled`, `status` (draft/published/cancelled), `published_at`, `cancelled_at`, `created_at`, `updated_at` | Belongs to Org. Belongs to Officer (creator). Has many EventRegistrations. Has many EventAttendances. |
| **EventRegistration** | A member's registration for an event. | `id`, `event_id`, `member_id`, `status` (registered/waitlisted/cancelled/pending_payment), `waitlist_position`, `payment_id` (nullable, for paid events), `registered_at`, `cancelled_at`, `promoted_at` (if promoted from waitlist), `payment_deadline` (for paid promotions) | Belongs to Event. Belongs to Member. Optionally belongs to Payment. |
| **EventAttendance** | A record of a member's check-in at an event. One per member per event (enforced). | `id`, `event_id`, `member_id`, `check_in_method` (qr/manual), `checked_in_by` (officer ID, for manual), `checked_in_at`, `synced_at` (for offline check-ins: when the local record was synced to server), `offline` (boolean: was this recorded offline) | Belongs to Event. Belongs to Member. |
| **EventQRSecret** | Per-event HMAC secret used for QR code generation and validation. | `id`, `event_id`, `hmac_secret` (encrypted), `created_at` | Belongs to Event. |

---

*End of Module 8: Events*
