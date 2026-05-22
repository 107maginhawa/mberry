# Job Board (Member View)

- **Route:** `/org/[id]/jobs`
- **Module:** M15 Job Board
- **Access:** Member (must be active member of this org)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓ (mobile-first)

## Purpose

Let members browse association-wide healthcare job listings filtered by specialty and location so they can find relevant employment opportunities without leaving the platform.

## Layout

### Desktop
Left sidebar org navigation. Main content: filter bar at the top, card list below (single column for readability — job listings are text-dense). A "Create Alert" button appears in the filter bar area if the member has no alerts configured. Infinite scroll.

### Mobile
Filter bar collapses to a horizontal chip row (employment type chips) plus a "Filters" button opening a bottom sheet for specialty and location. Single-column card list. Pull-to-refresh. "Create Alert" available as a button below the filter bar when no alerts are set.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Specialty Filter | Dropdown (multi-select) | Filter by one or more specialties from the platform's specialty list. "All specialties" default. |
| Employment Type | Chip group | All (default) / Full-time / Part-time / Locum/Relief / Contract. |
| Location Filter | Cascading dropdowns | Province dropdown, then city dropdown (optional, populated based on province selection). |
| Sort | Dropdown | "Most Recent" (default) / "Expiring Soon." |
| Create Alert Button | Secondary button | Shown when member has no active alerts. Opens alert configuration flow. Label: "Get notified about matching jobs." |
| Job Card | Card | Job title (bold). Organization/clinic name. Location (city, province). Employment type badge (colored chip). Specialty requirement. Expiry countdown ("12 days remaining" — amber text if fewer than 7 days). Save/bookmark icon (top-right corner of card). |
| Bookmark Icon | Toggle icon | Outlined = not saved. Filled = saved. Tapping toggles saved state immediately (optimistic update). Toast: "Saved to your job list." |
| Alert Active Badge | Info strip | "You have a job alert active for [Specialty] in [Location]." with "Manage alerts" link. Shown at the top of the board when the member has at least one active alert. |
| Empty State — no results | Illustration + text | Context-sensitive. |
| Empty State — no listings | Illustration + text | No listings at all on the association board. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards (5 placeholders) with shimmer. |
| Populated | Listings exist | Card list, most recent first. Load more at bottom. |
| Empty — no listings | No active listings on this association's board | "No job postings yet. Check back soon — new opportunities are added regularly." |
| Empty — filtered | Filters applied with no matches | "No listings match your filters. Try adjusting your specialty or location, or create an alert to be notified when matching positions are posted." |
| Saved | Member taps bookmark | Bookmark fills. Toast: "Saved to your job list." with a "View saved" link. |
| Unsaved | Member taps filled bookmark | Bookmark empties. Toast: "Removed from your job list" with 5-second "Undo." |
| Alert created | Member creates a job alert | Alert active badge appears at the top of the board. |
| Error | API failure | "Unable to load job listings. Pull down to retry." |

## Interactions

- **Association-wide board:** The job board is not scoped to this org — it shows all active listings across the entire association (all chapters + approved external employers targeting this association). This is the defining feature of the board. Members see opportunities from the whole network, not just their chapter.
- **Tapping a card:** Navigates to the job listing detail at `/org/[id]/jobs/[id]`.
- **Bookmark:** Immediate toggle, no confirmation needed. Saved listings are accessible from `/my/saved-jobs`. Saving does not notify the employer.
- **Job alert flow:** Tapping "Create Alert" opens a bottom sheet (mobile) or modal (desktop) with fields: specialty (multi-select), employment type (multi-select), location (province and city, optional). Saving the alert does not immediately search — it sets up future notifications. Members receive push/email notifications when matching listings are published.
- **Expiry countdown:** "X days remaining" is prominently shown on each card. When fewer than 7 days remain, the countdown text turns amber. This creates urgency and encourages members to save or apply promptly.
- **Lapsed/Grace members:** The job board is visible. Saving listings is allowed. Applying (tapping the contact email or external URL on the detail page) is also allowed since it goes off-platform. No restriction for Lapsed members on this screen.
- **Pagination:** First 20 listings load on page open. Scrolling to the bottom triggers the next 20 (infinite scroll on desktop). Mobile uses a "Load more" button to avoid position-jumping issues.
