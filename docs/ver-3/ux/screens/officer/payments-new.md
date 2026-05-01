# Record Payment

- **Route:** `/org/[id]/officer/payments/new`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Treasurer manually record an offline payment (cash, check, bank transfer, GCash) for a member, with live fund allocation preview and a confirmation dialog before committing.

## Layout

### Desktop
Sidebar navigation visible. Main content is a single-page form divided into three sections: Member Selection, Payment Details, and Fund Allocation Preview. The allocation preview panel updates live as the amount changes. A breadcrumb links back to `/org/[id]/officer/payments`.

### Mobile
Single-column stacked form. Fund allocation preview collapses into an expandable "Preview allocation" accordion below the amount field. Confirmation dialog is a full-screen bottom sheet on mobile.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Member search | Autocomplete input | Searches by member name or license number. Autocomplete results appear after 2 characters are typed, with 300ms debounce. Each result shows: member name, license number, status badge, category. Selecting a member locks in their identity and loads their membership info. If member not found: "Check spelling or add member first." |
| Member info block | Read-only display | Appears after member is selected: category, current status badge, current dues amount for their category, dues expiry date. This information pre-populates the amount field. |
| Amount field | Currency input | Pre-filled with the member's category dues amount. Editable — if treasurer changes it to a value that differs from the category rate, a warning appears inline: "Amount differs from category rate of [X]. Continue?" (does not block submission). |
| Date field | Date picker | Defaults to today. Can be backdated for recording past payments. |
| Method selector | Select dropdown | Cash / Check / Bank Transfer / GCash / Other. Required. |
| Reference number | Text input | Optional. Check number, bank reference, GCash reference, etc. |
| Fund allocation preview | Live preview panel | Shows how the entered amount will be split across configured funds (e.g., "General Fund: PHP 495.00 · Education Fund: PHP 495.00 · Building Fund: PHP 510.00"). Updates live within 200ms as the amount field changes. Uses the last-fund rounding algorithm (M6-R1). If no funds configured: "All payments go to the General Fund." |
| Concurrent payment warning | Alert | If another treasurer recorded a payment for the same member in the last 5 minutes: "A payment of [Amount] was just recorded for [Member] by [Other Treasurer] at [Time]. Are you sure this is a separate payment?" Treasurer can confirm or cancel (per M6-R4). |
| Confirmation dialog | Modal dialog | Triggered on form submit. Content: "Record payment of [Amount] for [Member]? This will extend their membership to [New Expiry Date]." Cancel returns to form. Confirm posts the payment. |
| Post-success links | Link row | After successful recording: "Record another payment" (resets the form) and "View [Member Name]'s profile" (links to roster detail). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading: member data | Member selected | Spinner replaces member info block briefly while category/dues info loads |
| Amount warning | Entered amount ≠ category rate | Inline warning below amount field: "Amount differs from category rate of [X]. Continue?" — non-blocking, allows override |
| Concurrent payment conflict | Recent payment detected (M6-R4) | Warning dialog before confirmation dialog; treasurer must acknowledge |
| Submitting | Confirm button clicked | Spinner on confirm button; form disabled; dialog fields grayed |
| Success | Payment recorded | Confirmation dialog closes; toast: "Payment recorded. Receipt sent to [Member]." Post-success links appear. Form resets for next entry. |
| Error: member not found | Search yields no results | "No members found. Check spelling or add the member to the roster first." |
| Error: API failure on submit | Server error | Toast (error): "Failed to record payment. Please try again." Dialog remains open. |

## Interactions

- Member search triggers autocomplete results after 2 characters are typed, with a 300ms debounce. Each result shows: member name, license number, status badge, and category. Clicking a result locks the member selection, loads their membership info block, and pre-fills the amount field with their category's annual dues rate.
- Amount field: editing the pre-filled value clears the "matches category rate" state and recalculates the fund allocation preview in real time (200ms debounce on keystroke). If the edited amount differs from the category rate, an inline warning appears below the field: "Amount differs from category rate of [X]. Continue?" — this is non-blocking and does not prevent submission.
- Fund allocation preview updates live as the amount changes. Each fund's peso amount is recalculated using the last-fund rounding algorithm (M6-R1). Individual fund amounts display to 2 decimal places. The preview panel always shows the sum equaling the entered amount exactly — no rounding discrepancy is surfaced to the officer.
- "Record Payment" button is disabled until all three required conditions are met: a member is selected, the amount is greater than 0, and a payment method is chosen. The date field defaults to today and is always valid, so it does not gate the button.
- Before the confirmation dialog: if another treasurer recorded a payment for the same member in the last 5 minutes, a concurrent-payment warning dialog appears first (per M6-R4): "A payment of [Amount] was just recorded for [Member] by [Other Treasurer] at [Time]. Are you sure this is a separate payment?" Cancel returns to the form. Confirm proceeds to the standard confirmation dialog.
- Confirmation dialog: "Record payment of [Amount] for [Member]? This will extend their membership to [New Expiry Date]." Cancel closes the dialog and returns to the form with all fields intact. Confirm posts the payment — the button shows a spinner and all dialog fields are disabled during submission.
- On success: dialog closes, toast "Payment recorded. Receipt sent to [Member]." Form resets to blank (member search cleared, amount cleared, method reset to default). Two post-success links appear below the form: "Record another payment" (keeps the blank form in place, just scrolls to top) and "View [Member Name]'s profile" (navigates to `/org/[id]/officer/roster/[id]`).
- On API failure during submit: dialog remains open, error toast "Failed to record payment. Please try again." Confirm button re-enables for retry — the officer does not need to re-enter data.
