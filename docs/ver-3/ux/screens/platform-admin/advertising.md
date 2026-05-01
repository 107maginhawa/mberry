# Advertising Dashboard

- **Route:** `/admin/advertising`
- **Module:** M16 Advertising
- **Access:** Platform Admin (all roles)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give Memberry operators a command center for the advertising business — reviewing pending items, monitoring active campaigns, and seeing revenue at a glance.

## Layout

Full-width dashboard page. Top row: five summary stat cards. Below the stat cards: an "Needs Attention" alerts panel with three sub-sections (pending advertiser approvals, pending creative reviews, auto-paused campaigns). Below the alerts panel: the active campaigns table. A "New Placement" button sits in the top-right header area. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Stat card: Active Campaigns | Stat card | Count of currently live campaigns. |
| Stat card: Pending Creative Review | Stat card | Count of creatives awaiting admin review. Amber highlight when > 0. |
| Stat card: Pending Advertiser Approvals | Stat card | Count of advertiser applications awaiting approval. Amber highlight when > 0. |
| Stat card: Total Impressions (Month) | Stat card | Total impressions delivered in the current calendar month. |
| Stat card: Revenue This Month | Stat card | Total revenue billed in the current calendar month, formatted in PHP. |
| Alerts panel | Grouped list | Header: "Needs Attention." Three sub-sections: (1) Advertiser applications awaiting approval — up to 5 listed with company name, type, and "Review" link to `/admin/advertising/advertisers/[id]`; (2) Creatives pending review — up to 5 listed with campaign name, advertiser, and "Review" link to `/admin/advertising/campaigns/[id]`; (3) Auto-paused campaigns — up to 5 listed with campaign name, advertiser, reason, and "Review" link. Each sub-section has a "View All" link if items exceed 5. |
| Active campaigns table | Sortable table | Columns: Campaign Name (linked to campaign detail), Advertiser, Association, Format (badge), Date Range, Impressions (delivered vs. cap/budget), Status (badge). Rows sorted by: auto-paused first, then live, then scheduled. |
| Status badge | Inline badge | Color-coded: Live = green, Scheduled = blue, Auto-Paused = red, Paused = amber, Completed = grey. |
| "New Placement" button | Secondary button | Navigates to `/admin/advertising/placements` with a focus on the new placement form. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards and table rows. |
| No placements configured | No ad slots exist | Below the stat cards: guidance message: "No ad placements have been configured yet. Set up your first placement to enable advertisers to book campaigns." with a "Configure Placements" link. |
| No active campaigns | No live or scheduled campaigns | Table shows: "No active campaigns." Stat cards still show impression and revenue totals. |
| Alerts panel empty | No pending items | Alerts panel shows: "No items requiring attention." |
| Auto-paused campaigns exist | One or more campaigns auto-paused by member reports | Auto-paused campaigns appear first in the alerts panel with a red border. Stat card for Pending Creative Review shows the count. |
| Error | Data fetch fails | Per-section error messages with retry. Stat cards show "--." |

## Interactions

- Clicking a campaign name in the table navigates to `/admin/advertising/campaigns/[id]`.
- "Review" links in the alerts panel navigate directly to the relevant advertiser or campaign detail page.
- "View All" links navigate to the respective list page with a filter pre-applied (e.g., `/admin/advertising/advertisers?status=pending`).
- Stat cards are display-only; no click interaction.
- The alerts panel is sorted by urgency: auto-paused campaigns first, then pending creative reviews, then pending advertiser approvals.
