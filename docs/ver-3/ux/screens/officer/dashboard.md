# Officer Dashboard

- **Route:** `/org/[id]/officer/dashboard`
- **Module:** M04 Org Admin
- **Access:** Officer (any role)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives any officer an at-a-glance view of org health and surfaces actionable items that require immediate attention.

## Layout

### Desktop
Sidebar navigation visible with full officer menu. Main content area opens with a key-metrics strip across the top (member count breakdown, collection rate, upcoming activities count), followed by a responsive grid of smart action cards below. A "New Announcement" or "Invite a Chapter" quick-action button lives in the header.

### Mobile
Hamburger menu collapses sidebar. Metrics strip stacks vertically. Action cards stack in a single column. Each card is tap-friendly with a clear CTA link.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Metrics strip | Stat cards (3-up) | Always-visible: Total members split into Active / Grace / Lapsed counts; Collection rate as percentage (green >80%, yellow 50-80%, red <50%); Upcoming activities in the next 30 days. |
| Smart action cards | Contextual card grid | Each card has a headline, count, and a direct-action link. Cards appear only when the underlying condition is true: "N members have unpaid dues — Send reminder" (links to roster filtered by Grace/Lapsed + reminder flow); "N membership applications pending — Review now" (links to `/org/[id]/officer/applications`); "Annual election due in N days — Schedule event" (links to event creation); "N members lapsing this month — View list" (links to roster filtered by expiring dues); "Officer transition incomplete — Resume checklist" (links to officer management). Cards disappear once their condition is resolved — no stale cards. |
| Onboarding wizard prompt | Banner | Shown only for new orgs with no data. Walks officer through: import members → set dues → connect payment gateway. Dismissed when each step is complete. |
| Invite a Chapter | Button (header) | Opens invite form: contact name + email. Send triggers email with org social-proof metrics and signup link (see M04 cap 4.8). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on metrics strip and all card grid slots |
| Empty / New org | No members, no payments, no events | Onboarding wizard prompt replaces card grid: "Let's get you set up." with three steps |
| Populated | Data exists | Metrics strip shows real values; only cards with true conditions render |
| Error | API failure | "Unable to load dashboard. Retry." with a retry button; metrics strip shows dashes |

## Interactions

- Clicking a smart action card's CTA link navigates directly to the relevant screen with the appropriate context pre-applied (e.g., "N members have unpaid dues — Send reminder" opens the roster pre-filtered to Grace/Lapsed status with the reminder flow ready; "N applications pending — Review now" navigates to `/org/[id]/officer/applications`). Cards with no action link are informational only.
- Smart action cards are condition-driven and update without a page reload — once the underlying condition resolves (e.g., all pending applications are approved), the card disappears from the grid immediately on next data refresh. No manual dismissal required.
- Clicking "Invite a Chapter" opens a modal form with two fields: contact name and email. Submitting the form validates email format inline; an invalid email shows "Please enter a valid email address." before allowing submit. On success: toast "Invitation sent to [email]." Modal closes. On failure (e.g., bounce-prone domain): modal stays open with an error.
- Clicking "Retry" on the error state re-fetches all dashboard data and restores the full layout on success.
- Onboarding wizard prompt steps are sequential: completing "Import members" enables "Set dues," completing "Set dues" enables "Connect payment gateway." Each completed step is marked with a checkmark and collapsed. The prompt disappears entirely once all three steps are done.
- Metrics strip values (member counts, collection rate, upcoming activities count) do not require user interaction — they load automatically and display skeleton shimmer until data arrives. Clicking the collection rate percentage navigates to `/org/[id]/officer/payments`.
- Clicking the upcoming activities count in the metrics strip navigates to the activities/events list filtered to the next 30 days.
