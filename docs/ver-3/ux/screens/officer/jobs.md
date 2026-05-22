# Officer Job Management

- **Route:** `/org/[id]/officer/jobs`
- **Module:** M15 Job Board
- **Access:** President, Secretary
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the President and Secretary a management view of all job listings posted by their organization — showing status, expiry, and quick actions to extend, close, or repost listings.

## Layout

### Desktop
Sidebar with Jobs active. Main content shows a data table with status-aware rows. A "Post a Job" button sits in the top-right. A status filter dropdown sits above the table on the left.

### Mobile
Card list replaces the table. Each card shows the job title, status badge, expiry countdown, and a three-dot overflow menu with Manage, Extend, and Close options. "Post a Job" is a floating action button at the bottom right.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status filter | Dropdown | All / Active / Expiring Soon / Expired / Closed Early / Draft. Defaults to "All." |
| Job listings table | Data table | Columns: Job Title, Employment Type, Location, Status, Posted Date, Expiry Date, Actions. |
| Status badge | Colored badge | Active (green), Expiring Soon (amber, fewer than 7 days remaining), Expired (gray), Closed Early (gray), Draft (blue), Pending Review (blue, external employer postings). |
| Manage link | Inline link | Per row. Navigates to /org/[id]/officer/jobs/[id]. |
| Post a Job button | Primary button | Navigates to /org/[id]/officer/jobs/new. |
| Expiry countdown | Text | "X days remaining." Amber text when fewer than 7 days. "Expired" text when past expiry. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton table rows with shimmer. |
| Empty — no listings | No listings ever posted | Empty state: "No job listings yet. Post your first job to reach active members across the association." CTA: "Post a Job." |
| Empty — filter | Status filter returns no results | "No listings match this filter." Suggestion to change filter. |
| Populated | Listings exist | Full table rendered. Default sort: most recently posted first. |
| Expiring soon highlighted | Listing within 7 days of expiry | Row background is amber-tinted. Status badge shows "Expiring Soon." |

## Interactions

- Clicking a row (desktop) or a card (mobile) navigates to the listing management page /org/[id]/officer/jobs/[id].
- Expired listings remain visible in this management view after expiry — they are not deleted, only removed from the member-facing board.
- Officers receive a push and email reminder exactly 3 days before a listing expires (per BR-37). The notification links directly to the listing management page.
- Listing status "Pending Review" applies only to external employer postings that are awaiting platform admin approval. Officer-posted listings from verified orgs are published immediately.
- Only officers with Secretary or President roles can access this screen. Other officer roles receive a 403.
