# Event Detail + RSVP (Member View)

- **Route:** `/org/[id]/events/[id]`
- **Module:** M08 Events
- **Access:** Member (must be active member of this org); public event pages accessible without auth at `/events/[id]`
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show a member the full details of an event and let them register (RSVP), join the waitlist, or view and display their check-in QR code if they are already registered.

## Layout

### Desktop
Single main column (max-width 720px, centered in the content area). Cover image hero at the top (full width, 16:9 ratio). Event metadata below in a structured summary block. Description (rich text) below that. Registration section follows — prominent, clearly separated. Hosting org card at the bottom (org name, logo, link to org public page).

### Mobile
Full-width cover image hero. All content stacks in a single column below. The registration section sticks to the bottom of the viewport as a floating action bar (button + seat availability count) so the RSVP action is always reachable without scrolling to the end of a long description.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Cover Image | Hero image | 16:9 crop. Falls back to a full-width colored banner with the event type icon if no image was uploaded. |
| Event Type Badge | Chip | One of the 8 platform-defined type labels (e.g., "General Assembly", "Fundraiser"). |
| Title | Heading (h1) | Event title. Cancelled events show a red "Cancelled" badge next to the title. |
| Date & Time | Metadata row | Start and end datetime with timezone. "Today" highlighted if event is happening today. |
| Location | Metadata row | Venue name + address with a map deep-link icon (opens maps app), or "Online Event" label with the meeting link shown as a button (only after registration is confirmed). |
| Registration Section | Action block | Shows: capacity display ("35 of 50 spots"), fee (if paid), and the primary action button. This is the central interaction on the page. |
| Primary Action Button | Button (prominent) | Context-sensitive label and state (see Interactions below). |
| Waitlist Position | Inline notice | Shown only if member is waitlisted. "You are #3 on the waitlist. We'll notify you if a spot opens." |
| QR Code Display | Full-screen overlay | Triggered by "Show QR Code" button (appears on event day for registered members). Rotating QR code (60-second TOTP), countdown timer, instructions. |
| My Registration Info | Info block | Visible once registered. Shows: registration date, payment receipt link (if paid), registration status (Registered / Pending Payment / Waitlisted / Checked In). |
| Hosting Org Card | Card | Org logo, org name, link to org public page. Visible to all. |
| Description | Rich text | Full formatted description from the officer. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton: hero placeholder, metadata rows, description block. |
| Open — not registered | Event has open spots, member not registered | Primary button: green "Register". Capacity: "X of Y spots remaining." |
| Open — free, instant | Free event, member clicks Register | Confirmation appears inline: "You're registered! Added to calendar." Calendar (.ICS) download offered. Button changes to "Registered" (disabled). |
| Open — paid | Paid event, member clicks Register | Member redirected to payment checkout (org gateway). Amount pre-filled. On payment confirmed: "Registration confirmed. Receipt sent to your email." |
| Pending payment | Paid registration not yet completed | Button: amber "Complete Payment". Notice: "Your registration is pending payment. Complete within 24 hours or your spot will be released." |
| Registered — before event day | Member registered, event not today | Shows registration info block. No QR button yet. Calendar link present. Cancel registration link. |
| Registered — event day | Member registered, today is event date | "Show QR Code" button appears prominently. Tapping opens full-screen rotating QR overlay. |
| Checked in | Member's attendance confirmed by officer | Registration status shows "Checked In" with timestamp. QR button removed. |
| Full — no waitlist | Capacity reached, no waitlist configured | Button grayed out: "Registration Full". No action available. |
| Full — join waitlist | Capacity reached, waitlist available | Button: orange "Join Waitlist". After tapping: waitlist position shown. |
| Waitlisted | Member on waitlist | Waitlist position card. Button changes to "Leave Waitlist". |
| Registration closed | Officer disabled registration or event is past | Button grayed out: "Registration Closed". |
| Cancelled | Event cancelled by officer | Red "Cancelled" banner across the top. All registration actions disabled. "This event has been cancelled." |
| Past | Event date has passed | "This event has ended" notice. No registration actions. If checked in: "You attended this event." |
| Error | API failure | "Unable to load event details. Try again." with retry button. |

## Interactions

- **Free registration:** Single tap on "Register" → immediate inline confirmation. No modal, no navigation. Confirmation replaces the button with a "Registered" state.
- **Paid registration:** Tapping "Register" navigates to the org's payment checkout. On successful webhook: redirect back to this page with confirmed state. On failure: "Payment failed. Try again or contact your treasurer."
- **Waitlist join:** Tapping "Join Waitlist" shows a confirmation: "Join the waitlist for this event?" → Confirm. Position shown immediately after.
- **Cancel registration:** "Cancel registration" link opens a confirmation dialog. If paid: "Refund is subject to the org's refund policy." Cancellation is immediate on confirm. If a waitlist exists, the first waitlisted member is auto-promoted (not visible to the cancelling member).
- **QR code display:** Full-screen overlay. QR rotates every 60 seconds. Countdown timer shows seconds until next rotation. A "This code is refreshing automatically" label reassures members. Close button (X) dismisses the overlay. Device must not sleep while QR is displayed (screen wake lock requested).
- **Lapsed member:** All registration actions are disabled. A banner above the registration section reads: "Your membership has lapsed. Renew your dues to register for events." "Renew" is a link to the dues payment flow.
