# Credit Compliance Report

- **Route:** `/org/[id]/officer/reports/credits`
- **Module:** M10 Credit Tracking
- **Access:** President, Officers
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives officers a full view of CPD credit compliance status for every member in the organization — showing each member's earned credits, required credits, percentage complete, and cycle end date — so officers can identify at-risk members and export the report for governance or regulatory purposes.

## Layout

### Desktop
Sidebar with Reports > Credits active. Main content has a filter bar at the top (cycle year selector, compliance status filter, membership category filter), followed by a sortable data table. An Export CSV button sits in the top right of the content area. Summary stat cards appear above the table: total members tracked, number compliant, number at-risk, number non-compliant.

### Mobile
Filter bar collapses to a filter icon that opens a bottom sheet. Summary stat cards are horizontally scrollable chips above the list. Table becomes a card list with the most important fields visible per card and a "View detail" tap target.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Summary stat cards | Metric cards | Four cards: Total Members Tracked, Compliant (green), At Risk (amber), Non-Compliant (red). Clicking each card filters the table to that compliance status. |
| Cycle year selector | Dropdown | Selects which credit cycle year to display. Defaults to the current cycle. Options show each historical cycle year available. |
| Compliance status filter | Segmented control or dropdown | All / Compliant / At Risk / Non-Compliant. Derived from CreditSummary.compliance_status (ON_TRACK / AT_RISK / NON_COMPLIANT). |
| Membership category filter | Dropdown | All categories / each active category. Filters by the member's assigned category. |
| Credit compliance table | Sortable data table | See column spec below. |
| Export CSV button | Secondary button | Downloads the currently filtered table as CSV. Filename: credit-report-[org-slug]-[cycle-year].csv. |
| Member name link | Inline link | Each member name links to /org/[id]/officer/roster/[id] which shows the member's individual credit detail. |

### Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Member Name | Full name (linked to member detail) | Yes |
| License # | Professional license number | Yes |
| Category | Membership category | Yes (filter) |
| Credits Earned | Total credits in current cycle including carryover | Yes |
| Credits Required | Required credits for this cycle | No |
| % Complete | (earned / required) x 100. Displayed as a progress bar + percentage. | Yes |
| Cycle End Date | Per-member cycle end date | Yes |
| Status | Compliance status badge: Compliant (green), At Risk (amber), Non-Compliant (red) | Yes (filter) |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton stat cards and table rows with shimmer. |
| Credit tracking disabled | Org has credit tracking toggled off in settings | Full-page informational state: "Credit tracking is not enabled for this organization. Enable it in Org Settings to track CPD compliance." CTA button: "Go to Settings." |
| Empty — no members | Org has no members with active credit cycles | Empty state: "No members with active credit cycles found." No table rendered. |
| Populated | Data loaded | Stat cards and table fully rendered. Default sort: % Complete ascending (non-compliant members first). |
| Filtered with no results | Filters return zero rows | "No members match your filters." Stat cards reflect filtered counts (all zero). |
| Export in progress | User clicks "Export CSV" | Button shows a spinner and "Exporting..." text. Disabled until download begins. |
| Export complete | CSV download begins | Button returns to default state. Browser download dialog is the confirmation. |

## Interactions

- The compliance status thresholds follow the prorated pace rule: if a member is 50% through their cycle and has earned fewer than 50% of required credits, they are AT_RISK. If they have earned 0 credits in the final 25% of their cycle, they are NON_COMPLIANT.
- Cycle year selector changes all data in the table, including the stat cards. Changing to a past cycle shows historical data (read-only).
- Clicking a stat card applies the corresponding compliance status filter to the table and scrolls to the table.
- "% Complete" progress bar: green when >= 100%, amber when 50-99%, red when < 50%.
- Member name links open the member detail page in the same tab. A browser back button returns to this report with filters preserved.
- The CSV export includes all columns shown in the table, respecting the current filter and sort state. Column order matches the screen. Cycle year and org name are included as metadata rows at the top of the CSV file.
- Credits are aggregated cross-org per BR-14: the totals shown here represent the member's full credit picture across all organizations they belong to, not just credits from this org's trainings.
- If credit tracking was enabled mid-cycle, a tooltip on the cycle selector explains: "Credits earned before credit tracking was enabled are not included."
