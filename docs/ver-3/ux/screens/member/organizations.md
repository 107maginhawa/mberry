# My Organizations

- **Route:** `/my/organizations`
- **Module:** M02 Member Profile & Settings, M05 Membership
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Give the member a single view of every organization they belong to, with independent status and dues information for each, and quick navigation into each org's scoped experience.

## Layout

### Desktop
Single-column, max-width 720px, centered within the authenticated shell (left sidebar visible). Page heading: "My Organizations." A card grid (1 column on desktop, since cards are wide) lists each org membership with rich detail. A "Find Organizations" secondary button sits at the top-right for members who want to apply to join additional orgs.

### Mobile
Full-width. Org cards stack in a single column. "Find Organizations" button appears at the bottom of the list or as a full-width card at the end of the stack. Bottom nav is visible with Profile tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org membership card | card | One card per org. Shows: org logo (or initial placeholder if no logo), org name, org type badge (Chapter / Society / National / Clinic), membership category, status pill (Active=green / Grace=amber / Lapsed=red / Suspended=gray / Pending=blue), dues expiry date or "Life Member" for Life category, joined date. Tapping the card navigates to that org's scoped member dashboard. |
| "Pay Dues" CTA on card | button | Appears on Grace or Lapsed cards. Links to the dues payment page for that org with amount pre-filled. |
| "Pending Verification" notice | badge | For imported members who have not yet claimed/verified their account with an org — the card shows a "Pending Verification" blue pill and a "Complete Account Setup" link. |
| "Suspended" notice | text | For Suspended status, the card shows the suspension status in gray and does not show a pay-dues CTA. |
| "Find Organizations" button | button | Secondary. Navigates to the org search/discovery flow where the member can apply to join additional orgs or request an invite. |
| Cross-org independence notice | info | Subtle explanatory text below the heading: "Each organization's status and dues are managed independently." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton card placeholders with shimmer animation. |
| Empty | Member has no org memberships | Full-page illustrated empty state: "You are not a member of any organization yet. Find your chapter or request an invitation." with a "Search Organizations" primary button and a secondary "Ask for an Invite" link. |
| Single org | Member belongs to exactly one org | Single card rendered; "Find Organizations" button is still visible for discoverability. |
| Multi-org, all Active | Member belongs to multiple orgs, all Active | All cards render with green status pills; no CTAs other than navigation. |
| Multi-org, mixed statuses | Member belongs to orgs with varying statuses | Each card renders its own status independently (M5-R10 / M2-R14). Grace and Lapsed cards show "Pay Dues" CTA; Active cards do not. |
| Error | Data fetch fails | Banner: "Could not load your organizations. Retry." with a retry button. |

## Interactions

- Tapping any org card navigates to that org's scoped member dashboard (e.g., `/org/[id]/home`), which shows org-specific announcements, events, trainings, and directory for that org.
- "Pay Dues" on a Grace or Lapsed card opens the payment page for that specific org; the one-tap payment link is pre-populated with the member's dues amount and category.
- Status pills are computed at page load (never cached stale per BR-01); pulling to refresh on mobile recomputes them.
- If the member is the sole officer of an org (e.g., President), the card includes a subtle "Admin" badge and the card tap navigates to the org's officer dashboard instead of the member-scoped view.
- Life members see "Life Member" in place of a dues expiry date, and no "Pay Dues" CTA is shown on their card — Life status always computes as Active (M5-R5).
