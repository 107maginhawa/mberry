# Analytics Hub

- **Route:** `/admin/analytics`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Analyst)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give Memberry operators and analysts a complete view of platform revenue health, feature adoption, org health, and churn signals to inform business decisions.

## Layout

Full-width analytics page. Global filters sit in a persistent top bar: date range selector, association filter, and country filter. Below the filter bar, four tabs divide the analytics into domains: Revenue, Adoption, Health, and Churn. Each tab renders a full dashboard of charts and tables. Export buttons are available per tab. No left sidebar.

## Components

### Shared

| Component | Type | Description |
|-----------|------|-------------|
| Date range selector | Date picker | Options: Last 30 days, Last 90 days, Last 6 months, Last 12 months, Custom range. Defaults to last 12 months. |
| Association filter | Dropdown | All associations, or a specific one. |
| Country filter | Dropdown | All countries, or a specific one. |
| Export button | Per-tab button | Generates CSV or PDF of the visible data. On click: format choice prompt (CSV / PDF). |

### Revenue Tab

| Component | Type | Description |
|-----------|------|-------------|
| MRR card | Stat card | Monthly Recurring Revenue with a trend arrow (vs. prior month) and sparkline for the selected period. |
| ARR card | Stat card | Annualized MRR projection. |
| ARPU card | Stat card | Average Revenue Per Org (not per member). |
| LTV card | Stat card | Estimated lifetime value based on average tenure and ARPU. |
| MRR trend chart | Line chart | MRR per month for the selected date range. Hover tooltips with exact values. |
| Revenue by association | Bar chart | Stacked or grouped bar chart showing each association's MRR contribution. Clickable bars drill into association detail. |
| Revenue by tier | Pie chart | Revenue share per subscription tier. |

### Adoption Tab

| Component | Type | Description |
|-----------|------|-------------|
| Module usage heatmap | Grid/heatmap | Rows = modules, columns = orgs (or tier groups). Color intensity = usage level (log scale: no usage = white, high usage = dark). Hover for exact usage count. |
| Feature adoption funnel | Funnel chart | Percentage of orgs that have activated each module (e.g., 100% Auth, 85% Membership, 40% Elections). |
| Time-to-first-value | Bar chart | Average days from org creation to first meaningful action per module (e.g., first member imported, first payment recorded). |

### Health Tab

| Component | Type | Description |
|-----------|------|-------------|
| Health score distribution | Histogram | Count of orgs in each score bracket (0–9, 10–19, ... 90–100). Green/amber/red color zones. |
| At-risk org table | Table | Orgs with health score < 40. Columns: Org Name, Association, Score, Last Officer Login, Last Payment, Signal (e.g., "No activity in 30 days," "5 members imported, 0 logged in"). "Outreach" button per row. |
| "Outreach" button | Inline action | Opens a draft outreach email addressed to the org's officers. Admin edits and sends. Action logged in the org's audit trail. |
| "Flag for Follow-up" | Inline action | Creates an internal admin reminder. |

### Churn Tab

| Component | Type | Description |
|-----------|------|-------------|
| Churn rate trend | Line chart | Monthly churn rate (% of active orgs that cancelled) for the selected period. |
| Churned orgs table | Table | Columns: Org Name, Association, Tier, Last Activity Date, Tenure (months), Cancellation Reason (if captured), Cancelled Date. |
| Churn cohort analysis | Cohort grid | Orgs grouped by their sign-up month; shows what % of each cohort remained active at 1 month, 3 months, 6 months, 12 months. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Tab switch or filter change | Chart skeletons per tab. Existing data remains visible during reload. |
| No revenue data | No paid subscriptions yet | Revenue tab: "No subscription revenue yet. Revenue data will appear once organizations convert from trial to paid plans." |
| No health data | No active orgs with members | Health tab: "Health scoring requires at least one active organization with imported members." |
| Insufficient churn data | < 3 months of data | Churn tab: "Not enough data for churn analysis. Requires 3 or more months of data." Cohort grid hidden. |
| No adoption data | No orgs using features | Adoption tab heatmap: all cells white with "No usage recorded." |
| Export success | Export generated | File downloads immediately. Toast: "Export ready." |
| Export failure | Generation error | "Export failed. The data set may be too large. Try narrowing your date range or filters." |
| Chart error | Individual chart data fails | Error shown within the chart area with a retry button. Other charts on the tab remain visible. |

## Interactions

- Charts are interactive: hover for value tooltips. Clicking a bar in the revenue by association chart applies an association filter to the entire tab.
- The "Outreach" button in the Health tab opens a pre-addressed email draft; the admin can edit and send. Sending logs the action in the org's activity tab.
- Export generates data for the currently visible tab with the currently active filters applied.
- Date range changes persist across tab switches within the same session.
- All four tabs maintain independent scroll positions; switching tabs does not scroll the user back to the top.
