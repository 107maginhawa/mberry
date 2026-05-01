# My Events

- **Route:** `/my/events`
- **Module:** M08 Events
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member view all the events they have registered for (upcoming, waitlisted, and past), display their rotating check-in QR code on event day, and cancel registrations.

## Layout

### Desktop
Single-column, max-width 720px, centered within the authenticated shell (left sidebar visible). Three labeled sections stack vertically: "Upcoming" (registered events with future dates), "Waitlisted" (events where the member is in a waitlist queue), and "Past" (events that have already occurred). Each section contains card rows. A "Browse Events" link appears at the top-right for discoverability.

### Mobile
Full-width. Same three-section structure; sections collapse if empty. On event day, a "Show QR" button on the relevant upcoming event card becomes the primary interaction. Bottom nav is visible with Events tab active (or the nearest equivalent tab depending on nav configuration).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Upcoming event card | card | Shows: event title, type badge (e.g., General Assembly / Fellowship / etc.), date and time, location (venue name or "Online"), registration status badge (Registered=green / Pending Payment=amber), payment status (Paid / Pending, for paid events), org name. |
| "Show QR" button | button | Primary. Appears on upcoming event cards when the event date is today. Opens the full-screen QR overlay for check-in. |
| QR code overlay | modal | Full-screen. Shows the rotating check-in QR code (regenerates every 60 seconds, TOTP-like per M8-R3). A countdown timer shows seconds until next rotation (e.g., "Refreshes in 34s"). Instructions: "Show this to the event officer for check-in." Close button (X) to dismiss. |
| Waitlisted event card | card | Shows same fields as upcoming card plus: waitlist position ("You are #3 on the waitlist"), expected notification behavior ("We'll notify you if a spot opens."). For paid waitlist promotions: "A spot opened! Complete payment to confirm." with a payment link. |
| Past event card | card | Shows: title, date, org, attendance status (Checked In=green / Missed=gray). No QR button. No cancel option (M8, M-18: cannot cancel after event date has passed). |
| "Cancel Registration" link | link | Appears on upcoming event cards only. Tapping shows a confirmation dialog. For paid events, the dialog includes the org's cancellation/refund policy. |
| "Browse Events" link | link | Top-right of the page heading area. Navigates to the activity feed or events listing to discover new events. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards with shimmer in each section. |
| Empty — no registrations | Member has no event registrations | Full-page illustrated state: "You haven't registered for any events. Discover upcoming events in your activity feed." with a "Browse Events" link. All three sections are hidden. |
| Upcoming section empty | No future registered events, but past events exist | "Upcoming" section shows: "No upcoming events. Browse events to register." Past section renders normally. |
| Waitlist section empty | Member is not waitlisted for any event | "Waitlisted" section is hidden entirely (does not render an empty state — the section simply disappears). |
| Event day — QR available | An upcoming event's date is today | "Show QR" button appears on the card in the Upcoming section for that event. |
| QR clock warning | Device clock is significantly out of sync | Inside the QR overlay: yellow notice: "Your device clock may be incorrect. QR validation may fail. Check your device time settings." |
| After check-in | Registration status updated to Checked In | Card in Upcoming section shows "Checked In" badge with timestamp. After the event date passes, the card moves to the Past section. |
| Paid registration — payment pending | Member registered for a paid event but payment not yet confirmed (webhook pending) | Card shows amber "Pending Payment" badge. Detail text: "Your payment is being confirmed. We'll update your registration when complete." |
| Waitlist promotion — paid event | Member is promoted from waitlist for a paid event | Toast notification (and in-app notification): "A spot opened for [Event]. Complete payment within 24 hours to confirm your registration." Card shows a "Complete Payment" CTA. |
| Cancellation — free event | Member confirms cancellation | Card is removed from the Upcoming list. Toast: "Registration cancelled." If a waitlist existed, the system automatically promotes the next waitlisted member (M8-R5). |
| Error | Data fetch fails | Toast: "Could not load your events. Please try again." Retry button. |

## Interactions

- "Show QR" on event day opens a full-screen overlay. The QR code is generated client-side using a TOTP-like mechanism and does not require network connectivity (M8-R3). The countdown timer ticks in real time.
- QR rotation is every 60 seconds; the validation window at the officer's scanner accepts the current code, the immediately preceding code, and the immediately following code (3 valid codes at any moment), with 30-second clock skew tolerance.
- Cancellation dialog for paid events shows the org's refund policy (if configured). Tapping "Cancel Registration" in the dialog triggers the cancellation and, if applicable, initiates the org's refund workflow through M06.
- "Browse Events" navigates to the activity feed filtered to show upcoming events from all the member's orgs.
- Past events are read-only — no QR, no cancellation, no interaction other than viewing the attendance status.
