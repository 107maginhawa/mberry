# My Saved Jobs

- **Route:** `/my/saved-jobs`
- **Module:** M15 Job Board
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member review all job listings they have bookmarked, see which are still active, and navigate to apply — without losing track of opportunities they showed interest in.

## Layout

### Desktop
Single-column, max-width 720px, centered within the authenticated shell (left sidebar visible). Page heading: "Saved Jobs." Cards stack in a single column, sorted by saved date (most recently saved first). Stale listings (expired or closed) are visually de-emphasized but still visible. A "Browse Job Board" link appears at the top-right.

### Mobile
Full-width. Same single-column card layout. Pull-to-refresh reloads the saved list and re-checks listing status (active vs. expired). Bottom nav is visible with the Profile tab active (Saved Jobs is a personal area linked from the profile or dashboard).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Saved job card | card | Same fields as the job board card: job title (bold), organization/clinic name, location (city, province), employment type badge (Full-time / Part-time / Locum-Relief / Contract — colored chip), specialty requirement, "X days remaining" expiry indicator (amber if fewer than 7 days). Saved date shown in muted text at the card bottom ("Saved Apr 21"). |
| "Expired" / "Closed" overlay badge | badge | Overlaid on cards for listings that are no longer active. Does not prevent the card from appearing — the member can still see the listing detail for reference. |
| "Unsave" button | button | Icon button (trash or bookmark-remove) on each card. Tapping removes the listing from the saved list immediately. Toast: "Removed from saved jobs" with a 5-second "Undo" option (M15, screen details). |
| "Apply" / "Apply Now" link | link/button | Appears on cards for active listings. If the listing has a contact email, opens the member's email client pre-addressed. If the listing has an application URL, navigates to the external URL. Both may be present on a single listing. |
| "View Listing" link | link | On each card (active or stale). Navigates to the full listing detail at `/org/[id]/jobs/[id]`. |
| "Browse Job Board" link | link | Top-right. Navigates to the member-facing association job board to discover more listings. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards with shimmer animation. |
| Empty | Member has not saved any jobs | Full-page illustrated empty state: "No saved jobs yet. Browse the job board and tap the bookmark icon to save listings for later." with a "Browse Job Board" primary button. |
| Active listings only | All saved listings are still active | Cards render normally with expiry countdown and apply links. |
| Stale listing present | One or more saved listings have expired or been closed by the officer | Those cards render with a gray "Expired" or "Closed" overlay badge. The "Apply" button is hidden. "View Listing" still navigates to the detail page but the detail page shows the expired/closed state. |
| Mixed active and stale | Some saved listings active, some expired | Active cards appear first (sorted by saved date within active status), then stale cards appear below with a visual separator: "No longer available." |
| Unsave success | Member taps unsave | Card animates out of the list. Toast: "Removed from saved jobs" with "Undo" button for 5 seconds. If "Undo" is tapped, the listing reappears in its original position. |
| Error | Data fetch fails | Toast: "Could not load your saved jobs. Please try again." Retry button. |

## Interactions

- Tapping a card body navigates to the listing detail (`/org/[id]/jobs/[id]`) where the full description, requirements, and application instructions are visible.
- "Apply" or "Apply Now" does not go through the platform — it opens the member's email client (mailto: link) or navigates to the employer's external application URL. The platform does not manage applications (M15, 15.10).
- Saved state persists across sessions and devices (M15, 15.6). A listing saved on mobile appears in the saved list on desktop.
- Stale listings remain in the saved list permanently (the member must manually unsave them). This is intentional — the member may want to reference the listing details or repost information even after it closes.
- The 5-second undo on unsave is a standard toast interaction: the card disappears immediately (optimistic), and if the server call fails, the card reappears with a toast: "Could not remove. Please try again."
- Pull-to-refresh (mobile) re-checks the status of each saved listing against current data, which may change "Active" cards to "Expired" if they lapsed since the last load.
