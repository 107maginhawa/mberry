# Member Dashboard

- **Route:** `/my/dashboard`
- **Module:** M01 Auth & Onboarding, M02 Member Profile & Settings, M05 Membership, M06 Dues & Payments, M08 Events, M09 Training, M10 Credit Tracking
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Give the member a cross-org aggregate view of their membership health, dues status, upcoming activities, and credit progress across all organizations they belong to — without requiring org switching.

## Layout

### Desktop
Authenticated layout with left sidebar visible (nav items: Dashboard, Profile, Events, Training, Credits, Notifications, ID Card). Main content area is a responsive grid: a full-width status banner row at top (one card per org showing membership status and dues expiry), then a 2-column grid of activity cards below (upcoming events, upcoming trainings, recent notifications, credit summary). An optional onboarding wizard prompt banner appears at the very top if the member has not completed profile setup (dismissible after 3 dismissals).

### Mobile
Bottom navigation bar is visible with Dashboard tab active (filled icon). Onboarding prompt (if present) appears as a slim dismissible banner at the top. Org status cards stack in a horizontally scrollable row. Activity cards stack in a single column below. Pull-to-refresh reloads all data.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Onboarding prompt banner | banner | "Complete your profile — 2 steps left." Visible until profile wizard is completed or dismissed 3 times. Tapping navigates to the optional member onboarding wizard. |
| Org membership status card | card | One per org the member belongs to. Shows: org logo, org name, membership category, status pill (Active=green, Grace=amber, Lapsed=red), dues expiry date, and "Pay Dues" CTA if Grace or Lapsed. Tapping the card navigates to that org's scoped dashboard. |
| Upcoming events card | card | Lists the next 2–3 events the member is registered for or events open for registration across all orgs. Each row shows event title, date, registration status badge (Registered/Open). Tapping navigates to the event detail or `/my/events`. |
| Upcoming trainings card | card | Lists the next 2–3 trainings the member is enrolled in or available to join across all orgs. Each row shows training title, credit value badge (e.g., "5 CPD"), date, enrollment status. Tapping navigates to training detail or `/my/training`. |
| Credit summary widget | card | Shows current cycle progress: credits earned vs. required, rendered as a progress ring or bar. Compliance status label (On Track / At Risk / Non-Compliant). Tapping navigates to `/my/credits`. |
| Recent notifications widget | card | Shows the 3 most recent unread notifications with type icon, title, and timestamp. "See all" link navigates to `/my/notifications`. |
| Account deletion banner | banner | Persistent across all pages during the 30-day grace period: "Your account is scheduled for deletion on [date]. Cancel deletion?" with a "Cancel" link. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton placeholders for all cards and widgets; shimmer animation. |
| Empty — no org memberships | Member has no org links | Org status row shows: "You are not a member of any organization yet. Find your chapter or ask for an invitation." with a "Search Organizations" button. Activity cards are hidden. |
| Empty — no upcoming activities | Member has registrations in no events or trainings | Upcoming events and trainings cards each show: "No upcoming activities. Browse events and trainings to get started." with links to the activity feed. |
| Grace or Lapsed org | At least one org membership has passed dues expiry | The affected org status card shows an amber (Grace) or red (Lapsed) pill and a prominent "Pay Dues" button that links to the dues payment flow for that org. |
| Onboarding prompt visible | Member has not completed profile wizard and has dismissed fewer than 3 times | The slim banner is rendered at top. After 3 dismissals, the banner is permanently hidden. |
| Error | Data fetch fails | Toast: "Could not load your dashboard. Pull to refresh." Retry button on desktop. |

## Interactions

- Tapping an org status card navigates to that org's member-scoped dashboard (e.g., `/org/[id]/home`).
- "Pay Dues" CTA on a Grace/Lapsed card navigates directly to the payment page for that org with amount pre-filled.
- Tapping the credit summary widget navigates to `/my/credits` with the current cycle in view.
- Pull-to-refresh (mobile) reloads all cross-org data simultaneously.
- The onboarding prompt banner is dismissed per session with an X button; after 3 dismissals across sessions it is permanently suppressed.
- The account deletion banner, when present, cannot be dismissed; it persists on every page until deletion is cancelled or the grace period expires.
