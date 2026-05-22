# Financial Dashboard & Payment List

- **Route:** `/org/[id]/officer/payments`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the Treasurer a real-time overview of the org's financial health and a searchable, filterable record of all payments.

## Layout

### Desktop
Sidebar navigation visible. Main content area opens with a four-card summary strip, then action cards in a row below, then a full-width payments table with search and filter controls. "Record Payment" primary button anchors the top-right header and links to `/org/[id]/officer/payments/new`.

### Mobile
Summary cards stack in a 2×2 grid. Action cards stack below. Payments table becomes a scrollable card list. Filter controls collapse into a filter sheet. "Record Payment" persists as a sticky bottom button.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Collection Rate card | Stat card | `paid / total = X%` for current billing period. Color-coded: green if >80%, yellow if 50-80%, red if <50%. |
| Total Collected card | Stat card | Currency-formatted total for the current period. |
| Outstanding card | Stat card | Currency-formatted total of unpaid dues across all members. |
| Pending Payments card | Stat card | Count of payments in "pending" status awaiting webhook confirmation or treasurer review. |
| Action cards | Contextual card row | Appear only when condition is true: "N members with expiring dues this month — Send reminders" (links to roster filtered by expiring); "N pending payments awaiting confirmation — Review" (scrolls to pending filter); "Gateway not configured — Set up now" (links to `/org/[id]/officer/settings/gateway`). |
| No-gateway banner | Alert banner | Prominent "Connect a payment gateway to accept online payments." with link to gateway setup. Shown above the table when no gateway is configured. |
| Search bar | Text input | Searches by member name or reference number. 300ms debounce. |
| Filter controls | Dropdown row | Filter by: Method (All / Online / Cash / Check / Bank Transfer / GCash / Other), Status (All / Completed / Pending / Failed / Refunded), Date range picker. |
| Payments table | Data table | Columns: Date, Member (linked to `/org/[id]/officer/roster/[id]`), Amount, Method badge, Status badge (completed=green / pending=yellow / failed=red / refunded=gray), Receipt download icon. 25 rows per page. Clicking a row navigates to `/org/[id]/officer/payments/[id]`. |
| Record Payment button | Primary button | Links to `/org/[id]/officer/payments/new`. |
| Export button | Secondary button | Exports current filtered view to CSV. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on stat cards and table |
| No gateway | Gateway not configured | No-gateway banner above table; Collection Rate shows "--" |
| No payments | No payments recorded yet | "No payments recorded yet. Record your first payment or configure online payments." Empty table; stat cards show zeros. |
| Populated | Payments exist | Full dashboard with real data |
| Filtered — no results | Search or filter yields nothing | "No payments match your filters." with "Clear filters" link |
| Error | API failure | "Unable to load payments. Retry." with retry button |

## Interactions

- Search bar filters the payments table by member name or reference number with a 300ms debounce. Search and filter dropdowns (Method, Status, Date range) combine as AND filters. Clearing any filter control immediately refreshes the table.
- Clicking a row in the payments table navigates to `/org/[id]/officer/payments/[id]`. The member name cell within a row is a separate link to `/org/[id]/officer/roster/[id]` — clicking the name opens the member profile, not the payment detail.
- "Record Payment" button in the header navigates to `/org/[id]/officer/payments/new` with no pre-selection.
- Action card "N members with expiring dues this month — Send reminders" navigates to `/org/[id]/officer/roster` with the status filter pre-set to show members with dues expiring this month, and the bulk reminder flow pre-triggered (bulk action toolbar visible with "Send Reminder" highlighted).
- Action card "N pending payments awaiting confirmation — Review" sets the Status filter dropdown to "Pending" and scrolls the table into view — it does not navigate away from the page.
- Action card "Gateway not configured — Set up now" navigates to `/org/[id]/officer/settings/gateway`.
- Receipt download icon in the table: clicking downloads the PDF receipt for that row's payment directly without navigating to the payment detail page.
- "Export" button exports the currently filtered view (not the full payment history) as a CSV download. If no filter is active, all payments are exported. The button is always enabled when payments exist.
- Stat cards (Collection Rate, Total Collected, Outstanding, Pending Payments) are read-only. Clicking any stat card does not navigate — they are informational only.
