# Financial Reports

- **Route:** `/org/[id]/officer/reports/financial`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Treasurer generate, view, and export financial reports — collection summary, fund breakdown, dues status, and aging — for any selected date range.

## Layout

### Desktop
Sidebar navigation visible. Main content is a three-step flow in a single page: Step 1 is a four-card report selector at the top; Step 2 is a filter/date-range bar that appears after a report is selected; Step 3 is the results area (data table + summary metrics + export buttons) that renders below the filters. All three sections are visible on the same page after a report is generated.

### Mobile
Single-column. Report selector is a horizontal scroll of cards or a full-width radio list. Filters stack below the selector. Results table scrolls horizontally for wide columns. Export buttons appear below the results.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Report selector | Four option cards | Collection Summary (bar chart icon), Fund Breakdown (pie chart icon), Dues Status (list icon), Aging Report (clock icon). Selecting a card highlights it and reveals the filter row below. |
| Date range picker | Date range input | Start date + end date. Defaults to current year (Jan 1 - today). End before start shows inline error: "Invalid date range." |
| Additional filters | Contextual dropdowns | Per report type: Collection Summary - filter by Payment Method; Fund Breakdown - filter by specific Fund; Dues Status - filter by Status (Active/Grace/Lapsed) and by Category; Aging Report - date range only. |
| Generate / Refresh button | Primary button | Triggers the report query with current filters. On first load: "Generate Report." After generated: "Refresh" when filters change. |
| Summary metrics bar | Stat row | Key numbers shown above the table. Per report: Collection Summary shows Total Collected, Total Outstanding, Collection Rate %, trend direction; Fund Breakdown shows Net per fund; Dues Status shows counts per status; Aging Report shows total overdue amount and member count. |
| Results table | Data table | Report-specific columns (per M6-R7 definitions). Includes a totals/summary row at the bottom. Accurate to the centavo. Matches actual gateway records. |
| Export buttons | Button pair | "Download CSV" (raw data, all rows) and "Download PDF" (formatted report with org branding, date range header, summary). Both buttons disabled when no data is loaded. |

## Report Definitions (per M6-R7)

| Report | Key Columns | Notes |
|--------|-------------|-------|
| Collection Summary | Date, Member, Amount, Method, Status; monthly trend chart | Breakdown by online vs manual |
| Fund Breakdown | Fund Name, Percentage, Period Total, Refund Reversals, Net Total | Refund reversals appear as negative entries |
| Dues Status | Member Name, Category, Status, Dues Expiry, Amount Due | All members regardless of payment history |
| Aging Report | Member Name, Overdue Duration Bucket (1-30 / 31-60 / 61-90 / 90+ days), Amount Due | Grouped by bucket with count and total per bucket |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on report selector cards |
| No report selected | Page loaded, no card clicked | Filter row and results area are hidden; prompt: "Select a report type to get started." |
| Generating | Generate clicked | Spinner on Generate button; results area shows loading skeleton |
| Populated | Report data returned | Summary metrics and full results table render; export buttons enabled |
| No data | Query returns 0 rows | "No data found for the selected period and filters." Empty table. Export buttons disabled. Not an error — shown as a calm empty state. |
| Exporting | Download CSV / Download PDF clicked | Spinner on clicked button; "Generating [format]..." label. Download starts automatically when ready. |
| Error: invalid date range | End date before start date | Inline error below date range: "Invalid date range. End date must be after start date." Generate button disabled. |
| Error: API failure | Report query fails | Toast (error): "Failed to generate report. Please try again." Generate button re-enabled. |

## Interactions

- Report selector cards: clicking a card selects it (highlighted border), deselects any previously selected card, and reveals the filter row below. Clicking the same card again does not deselect it — a report type must always be selected once the section is visible.
- Date range picker: selecting a start date later than the end date (or vice versa) shows an immediate inline error "Invalid date range. End date must be after start date." and disables the Generate button. Both dates must be valid before the button re-enables.
- Additional filters (Method, Fund, Status, Category) are contextual — they appear only after a report type is selected and are specific to that report. Changing a filter does not auto-regenerate the report; the officer must click "Refresh" (the button relabels from "Generate Report" to "Refresh" after the first generation).
- "Generate Report" / "Refresh" button: shows a spinner on click and runs the query with the current filter state. The results area below shows a loading skeleton during generation. If a report is already displayed and the officer changes filters, the button changes label to "Refresh" to indicate the current results are stale.
- Results table: all data is read-only. Clicking a member name in the Dues Status or Aging report rows navigates to `/org/[id]/officer/roster/[id]` — the officer can jump from a report directly to a member's profile.
- "Download CSV" exports all rows matching the current filters (not just the visible page) as a raw CSV. The button shows "Generating CSV..." and disables briefly; download starts automatically when ready.
- "Download PDF" generates a formatted report with org branding, the current date range in the header, and the summary metrics section. The button shows "Generating PDF..." during generation. Both export buttons are disabled when no data is loaded (empty state or before first generation).
- Switching to a different report type resets the results area and additional filters to their defaults for the new report, but preserves the date range selection.
- The Collection Summary report includes a monthly trend chart above the table. The chart is rendered as a bar chart; hovering a bar shows a tooltip with the exact total for that month.
