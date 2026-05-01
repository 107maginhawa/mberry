# All Campaigns

- **Route:** `/admin/advertising/campaigns`
- **Module:** M16 Advertising
- **Access:** Platform Admin (all roles)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete view of all advertising campaigns across all advertisers and associations, with filters to find campaigns by status, advertiser, or association.

## Layout

Full-width filterable table page. A filter bar below the page title provides controls for status, association, advertiser search, and date range. Below the filter bar, a sortable, paginated table of all campaigns. Clicking any row navigates to that campaign's detail page. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status filter | Dropdown | All, Draft, Pending Creative, Pending Review, Scheduled, Live, Paused, Auto-Paused, Completed, Cancelled. |
| Association filter | Dropdown | All associations or a specific one. |
| Advertiser search | Text input | Search by company name; debounced 300ms. |
| Date range filter | Date range picker | Filters to campaigns active during the specified period (start ≤ filter end AND end ≥ filter start). |
| Campaigns table | Sortable table | Columns: Campaign Name (linked to campaign detail), Advertiser, Association, Format (badge), Date Range, Impressions (delivered / cap or budget), Status (badge). |
| Status badge | Inline badge | Draft = grey, Pending Creative = grey, Pending Review = amber, Scheduled = blue, Live = green, Paused = amber, Auto-Paused = red with pulse, Completed = grey, Cancelled = red (muted). |
| Impressions progress | Display | "18,500 / 50,000 imp." or "18,500 delivered" for flat monthly. Progress shown as a mini bar for CPM campaigns near their cap. |
| Pagination | Footer | 25 rows per page. |
| Active filters chips | Below filter bar | Each active filter shown as a removable chip (e.g., "Status: Live ×"). "Clear all" link. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load or filter change | Table skeleton. |
| Empty | No campaigns exist | "No campaigns found. Campaigns appear once advertisers create them." |
| Filtered, no results | Filter returns zero | "No campaigns match your filters." with "Clear filters" link. |
| Auto-paused campaigns present | Campaigns in Auto-Paused status | Those rows appear at the top of the table regardless of sort order, with a red pulsing status badge. A banner above the table: "[N] campaign(s) auto-paused due to member reports. Review required." |
| Error | Fetch fails | "Could not load campaigns. Retry." |

## Interactions

- Row click navigates to `/admin/advertising/campaigns/[id]`.
- Auto-paused campaigns are pinned to the top of the table as they require immediate admin action; other sort preferences apply below the pinned rows.
- The date range filter is inclusive: a campaign is included if any part of its date range overlaps with the filter range.
- All column headers except Impressions are sortable. Default sort: Status (auto-paused → pending review → live → scheduled → paused → completed → cancelled), then by campaign start date descending within each group.
- Clicking the Advertiser cell navigates to that advertiser's detail page.
