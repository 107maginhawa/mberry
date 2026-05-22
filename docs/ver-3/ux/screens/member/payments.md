# My Payments

- **Route:** `/my/payments`
- **Module:** M06 Dues & Payments
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show the member a complete history of all their payments across all organizations, with the ability to filter, view details, and download receipts.

## Layout

### Desktop
Single-column, max-width 800px, centered within the authenticated shell (left sidebar visible). A filter bar sits at the top (org selector, date range, payment status). Below that, a table of payments sorted by date descending (newest first) with pagination at 20 rows per page. Clicking any row expands inline to show payment detail and a receipt download button.

### Mobile
Full-width. Filter bar collapses into a "Filter" button that opens a bottom sheet with filter options. Payments render as full-width cards stacked vertically in reverse-chronological order. Tapping a card expands it to show detail inline. Bottom nav is visible with Profile tab active (Payments is reached via Dashboard or Profile quick links).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Filter bar — org selector | select | Dropdown: "All Organizations" or a specific org by name. Filters the list to payments from that org only. |
| Filter bar — date range | input | Start date and end date pickers. Defaults to current year. |
| Filter bar — status filter | select | Options: All, Completed, Pending, Refunded, Expired. |
| Payment row / card | list | Columns: Date (payment_date), Organization name, Amount (currency-formatted), Method (Online / Cash / Check / Bank Transfer / GCash), Status badge (completed=green / pending=yellow / failed=red / refunded=gray / expired=orange). On mobile, each row becomes a full-width card with the same fields. |
| Payment detail (expanded) | section | Shows on row/card tap: fund allocation breakdown (per-fund name and amount), reference number, receipt number (format: ORG_CODE-YEAR-NNNNNN per M6-R6), "Download Receipt" button. |
| "Download Receipt" button | button | Secondary. Triggers browser download of the PDF receipt (org name + logo, member name, amount, date, method, fund allocation breakdown, receipt number). |
| "Pay Dues" prompt card | card | If any org has Grace or Lapsed status, a highlighted prompt card appears at the top of the list: "You have outstanding dues for [Org]. Pay now to maintain Active status." with a "Pay Dues" link navigating to the payment page. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table/card list shows skeleton rows; shimmer animation. |
| Empty | Member has no payment history | Full-page message: "No payment history yet. Your dues payments and activity fees will appear here." No table is rendered. |
| Filtered — no results | Active filters match no payments | Inline message in the table area: "No payments match your filters. Try adjusting the date range or status." |
| Pending payment | A payment has been initiated but webhook not yet confirmed | Row shows yellow "Pending" badge. Expanded detail shows: "Your payment is being confirmed. This usually takes a few minutes." |
| Expired payment | Online payment was pending for >24 hours with no webhook | Row shows orange "Expired" badge. Expanded detail: "This payment was not confirmed. Contact your treasurer if you completed the payment." |
| Refunded | A refund has been processed | Row shows gray "Refunded" badge. Expanded detail shows refund amount and refund date. |
| Error | Data fetch fails | Toast: "Could not load your payment history. Please try again." Retry button. |

## Interactions

- Clicking or tapping a payment row/card expands inline to show the detail section; clicking again collapses it. Only one row can be expanded at a time on desktop; on mobile, expansion is always visible on tap navigation.
- "Download Receipt" triggers the browser's native file download. PDF includes the fund allocation breakdown even if the member's view only shows the total amount paid.
- Payments labeled "Manually Recorded" in the expanded detail view include a note: "Recorded by [Treasurer Name]."
- The "Pay Dues" prompt card links to the one-tap payment page for the affected org. If multiple orgs have outstanding dues, a separate prompt appears for each.
- Pagination on desktop: 20 rows per page with previous/next controls. On mobile: infinite scroll loads the next 20 items on reaching the bottom.
