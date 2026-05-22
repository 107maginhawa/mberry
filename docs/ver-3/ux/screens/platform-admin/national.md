# National Dashboard

- **Route:** `/admin/national`
- **Module:** M14 National Dashboard
- **Access:** Platform Admin (all roles); National Officers (designated per association)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give national association officers and platform admins an aggregate, real-time view of association health across all chapters — membership totals, dues collection, CPD compliance, and activity — without exposing individual member records.

## Layout

Full-width dashboard page. For Platform Admins, an association selector dropdown sits at the very top; National Officers see no selector and land directly on their association's data. Below the selector (or below the header for National Officers), a row of six summary cards. Below the cards, two trend charts side-by-side. The lower half of the page is the chapter health comparison table. An "Export" button and date range selector appear in the top-right area. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Association selector | Dropdown (Platform Admin only) | Lists all active associations. Selecting one reloads the page metrics for that association; URL updates to `/admin/national/[id]`. National Officers do not see this control. |
| Summary card: Total Members | Stat card | Total member count across all chapters. |
| Summary card: Active Members | Stat card | Active member count + percentage of total. |
| Summary card: Chapters | Stat card | Total chapter count under this association. |
| Summary card: Dues Collection Rate | Stat card | Association-wide % of members current on dues for the current cycle, with a month-over-month trend arrow. |
| Summary card: CPD Compliance Rate | Stat card | % of members meeting their current CPD cycle requirement. |
| Summary card: Events & Training | Stat card | Total event and training session count; configurable period toggle (last 30 / 60 / 90 days). |
| Membership by Status trend chart | Stacked area chart | 12-month rolling chart. Series: Active, Grace, Lapsed, Suspended. Date range configurable (3, 6, 12, 24 months). |
| Dues Collection Rate trend chart | Line chart | 12-month rolling association-wide collection rate per month. Same date range control. |
| Date range selector | Segmented control | Applies to both trend charts: 3M, 6M, 12M, 24M. |
| Chapter health comparison table | Sortable table | Columns: Chapter Name (linked to chapter drill-down), Region, Members, Active %, Dues Collection Rate, Activity Count (last 90 days). Column headers sortable. Active % and Dues Rate cells color-coded: green > 70%, amber 50–70%, red < 50%. Default sort: alphabetical by chapter name. |
| Table filters | Controls above table | Region dropdown (multi-select), "Needs Attention" toggle (shows only chapters where any metric is red). |
| Pagination | Footer | 25 chapters per page; virtual scroll for associations with > 100 chapters. |
| Export button | Secondary button | Prompts for format (PDF / CSV). Generates current view including summary cards and full chapter comparison table. All exports are aggregate-only — no individual member PII. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load or association switch | Skeleton cards and chart placeholders. Summary cards load first; charts and table load sequentially. |
| No chapters | Association has no chapters | Empty state: "No chapters have been added to this association yet. Add chapters through Platform Administration." |
| Single chapter | Only one chapter exists | Table shows one row. No sorting applied. Export still available. |
| No activity data | Chapter has no events logged | Activity count = 0. Table cell shows "0" without color coding. |
| Insufficient access | Non-authorized user navigates to the route | 403 page: "You do not have access to this page. If you believe this is an error, contact your platform administrator." |
| Mobile access | Mobile viewport detected | Banner: "The National Dashboard is designed for desktop use. For the full experience, please open this page on a computer." Summary cards shown in stacked mobile layout; charts and full comparison table hidden. |
| Error | Data fetch fails | Per-section error with retry. Summary cards show "--" values. |

## Interactions

- Clicking a chapter name in the comparison table navigates to `/admin/national/[id]/orgs/[id]`.
- Date range selector change reloads both trend charts simultaneously.
- "Needs Attention" toggle filters the table to chapters where Active % or Dues Collection Rate is red (< 50%). The toggle label shows the count: "Needs Attention (5)."
- Export: for large associations (> 50 chapters), a generating spinner appears for up to 10 seconds before the download begins. All exports are logged in the audit trail with: exporting user, report type, association scope, date/time.
- National Officers who navigate to `/admin/national` are automatically redirected to `/admin/national/[their-association-id]` since they have access to only one association.
