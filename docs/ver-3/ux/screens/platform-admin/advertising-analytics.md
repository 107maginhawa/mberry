# Advertising Analytics

- **Route:** `/admin/advertising/analytics`
- **Module:** M16 Advertising
- **Access:** Platform Admin (all roles)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give Memberry operators an aggregate view of advertising revenue and campaign performance across all advertisers, associations, and formats — for internal business reporting and pricing decisions.

## Layout

Full-width analytics page. A date range selector sits at the top. Below it, a row of five summary metric cards. Below the cards, three breakdown tables side-by-side (or stacked on narrower desktop viewports): by association, by ad format, and by advertiser. Below the breakdown tables, two charts: daily impressions trend and monthly revenue bar chart. An "Export" button is in the top-right. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Date range selector | Segmented control + custom option | Options: Current Month (default), Last 30 days, Last 60 days, Last 90 days, Custom range. Applies to all metrics and charts. |
| Stat card: Total Impressions | Stat card | Total impressions delivered across all campaigns in the selected period. |
| Stat card: Total Clicks | Stat card | Total clicks (for ads with links) in the selected period. |
| Stat card: Average CTR | Stat card | Average click-through rate across all campaigns with links. |
| Stat card: Total Unique Estimated Reach | Stat card | Deduplicated member count reached across all campaigns (aggregate estimate). |
| Stat card: Total Revenue Billed | Stat card | Total PHP billed to advertisers in the selected period. |
| Breakdown table: By Association | Table | Columns: Association, Impressions, Clicks, CTR, Revenue. Sortable by any column. |
| Breakdown table: By Ad Format | Table | Columns: Format, Impressions, Clicks, CTR, Revenue. Rows: Banner Top, Banner Sidebar, Sponsored Feed Post, Directory Highlight. |
| Breakdown table: By Advertiser | Table | Columns: Advertiser (linked to advertiser detail), Active Campaigns (count), Impressions, Clicks, CTR, Revenue. Sortable. |
| Daily impressions chart | Line chart | Impressions per day for the selected period. Hover tooltips with date and exact count. |
| Monthly revenue chart | Bar chart | Total revenue billed per month for the last 12 months, regardless of selected date range (fixed window). Highlights the current month. |
| Export button | Secondary button | Downloads a CSV of all campaign performance data for the selected period. Contains aggregate columns only — no individual member identifiers. File name: `memberry-ad-analytics-[date-range].csv`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load or date range change | Skeleton cards and chart placeholders. |
| No data | No campaigns have run in the selected period | Stat cards show "0" or "—." Charts show empty axes with "No data for this period." Breakdown tables show empty state rows. |
| New platform | No campaigns have ever run | All stat cards show "—." Guidance: "No advertising activity yet. Performance data will appear once the first campaign delivers impressions." |
| Export generating | Export clicked | Button spinner. For large date ranges: "Generating export..." inline label. File downloads when ready. |
| Export error | Generation fails | "Export failed. Try narrowing your date range." Toast. |
| Error | Any section fetch fails | Inline error per section with retry. Other sections remain visible. |

## Interactions

- Date range selector change reloads all stat cards, breakdown tables, and the daily impressions chart simultaneously. The monthly revenue bar chart does not change with the date range selector (it always shows the last 12 months).
- Advertiser name links in the By Advertiser table navigate to `/admin/advertising/advertisers/[id]`.
- All breakdown tables are sortable independently.
- Charts are interactive: hover for value tooltips on the line chart; hover for bar values on the monthly chart.
- Export CSV columns: campaign_id, campaign_name, advertiser_id, advertiser_name, association_id, format, date_range_start, date_range_end, impressions, clicks, ctr, revenue_php. No member identifiers.
- This screen is for internal Memberry use only. Advertiser-facing analytics are scoped per advertiser and accessed through the campaign detail page.
