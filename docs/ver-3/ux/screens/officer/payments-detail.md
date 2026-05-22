# Payment Detail

- **Route:** `/org/[id]/officer/payments/[id]`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the Treasurer a complete record of a single payment — all details, fund allocation breakdown, and refund actions.

## Layout

### Desktop
Sidebar navigation visible. Main content is a two-column layout: a wide left column with the full payment record, and a narrower right column with the refund action panel and related links. A breadcrumb links back to the payments list.

### Mobile
Single-column scroll. Payment details first, fund allocation below, refund panel below that as a collapsible section.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Payment header | Header block | Receipt number (format: `[ORG_CODE]-[YEAR]-[SEQUENTIAL]`), status badge (completed=green / pending=yellow / failed=red / refunded=gray / expired=orange), payment date, member name (linked to roster detail). |
| Payment details | Detail list | Amount, currency, payment method, reference number, recorded by (officer name for manual, "Online" for gateway), gateway transaction ID (for online payments — shown to treasurer only). |
| Fund allocation breakdown | Data table | Columns: Fund Name, Percentage, Amount allocated. Totals row shows sum (always equals payment amount). If refunded: reversal entries shown as negative rows in red with "Refund reversal" label. |
| Receipt download | Button | "Download Receipt (PDF)" — downloads the PDF receipt for this payment. Marked "Manually Recorded" if applicable. |
| Membership extension info | Read-only display | "This payment extended [Member]'s membership from [old expiry] to [new expiry]." |
| Refund panel | Action panel | Visible when status = completed or partially_refunded. "Refund" button opens the refund form. If already fully refunded: "Refund" button is disabled with tooltip "This payment has already been fully refunded." |
| Refund form | Inline form (expands on click) | Amount field (defaults to full payment amount; editable for partial refund — cannot exceed original amount). Reason textarea (required). "Initiate Refund" button triggers a confirmation dialog: "Refund [Amount] to [Member]? Fund allocations will be reversed. If this was a dues payment, membership status may change." |
| Expire / void actions | Button (pending only) | For expired online payments (pending >24 hours): "Mark as Void" or "Manually Confirm" buttons with confirmation dialogs. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on all detail sections |
| Completed | status = completed | Full detail visible; refund panel active |
| Pending | status = pending | Status badge yellow; "Awaiting webhook confirmation." shown; refund panel hidden; expire/void actions shown if >24 hours old |
| Failed | status = failed | Status badge red; "Payment failed. No membership changes were made." No refund option. |
| Expired | status = expired (>24 hr pending) | Status badge orange; treasurer notified banner; manually confirm or void options shown |
| Refunded | status = refunded | Refund button disabled; reversal rows shown in fund allocation table in red |
| Partially refunded | status = partially_refunded | Partial refund rows shown in fund allocation; refund button re-enabled for remaining balance |
| Refund submitting | Confirm clicked in refund form | Spinner on button; form disabled |
| Refund success | Refund confirmed | Toast: "Refund of [Amount] processed." Status badge updates. Fund allocation table refreshes with reversal rows. Member is notified. |
| Refund failed | Gateway error | Toast (error): "Refund failed. Gateway error: [message]. Retry?" Retry button shown in refund panel. |
| Error: not found | Invalid payment ID | "Payment record not found." with link back to payments list |

## Interactions

- Breadcrumb link at the top navigates back to `/org/[id]/officer/payments`, preserving any filters that were active before entering this detail view.
- Member name in the payment header is a link — clicking it navigates to `/org/[id]/officer/roster/[id]` (the member's profile).
- "Download Receipt (PDF)" button triggers an immediate download. The PDF is generated server-side; the button shows a brief "Generating..." state (under 2 seconds for typical receipts) before the download starts.
- Refund flow: clicking "Refund" expands the refund form inline within the right panel (not a modal). The amount field defaults to the full payment amount and is editable for partial refunds. Attempting to enter a refund amount greater than the original payment shows immediate inline validation: "Refund cannot exceed the original payment amount of [X]." The reason textarea is required — "Initiate Refund" is disabled until at least one character is entered.
- Clicking "Initiate Refund" with a valid amount and reason opens a confirmation dialog: "Refund [Amount] to [Member]? Fund allocations will be reversed. If this was a dues payment, membership status may change." Cancel closes the dialog and returns to the form with fields intact. Confirm submits the refund — the button shows a spinner during processing.
- On refund success: dialog closes, toast "Refund of [Amount] processed." The status badge updates, and the fund allocation table refreshes to show reversal rows as negative entries in red with "Refund reversal" labels. The member receives an in-app notification automatically.
- On refund gateway failure: toast "Refund failed. Gateway error: [message]. Retry?" A "Retry" button appears in the refund panel — clicking it re-submits the refund request without requiring the officer to re-enter the amount and reason.
- For expired payments (pending >24 hours): "Manually Confirm" opens a dialog: "Confirm this payment manually? This will extend [Member]'s membership as if the payment succeeded. Use only after verifying in your gateway dashboard." Confirm posts the manual confirmation. "Mark as Void" opens a dialog: "Void this payment? No membership changes will be made." Confirm voids the record.
- Fund allocation breakdown table rows are read-only — no clickable cells. The totals row always equals the payment amount (or net amount for partially refunded payments).
