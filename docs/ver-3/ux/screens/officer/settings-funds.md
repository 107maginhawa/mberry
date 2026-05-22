# Fund Allocation Configuration

- **Route:** `/org/[id]/officer/settings/funds`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Treasurer define how every dues payment is automatically split across the org's funds, with live validation that percentages always total exactly 100%.

## Layout

### Desktop
Sidebar navigation visible. Main content is a single focused settings page: a sortable list of fund rows, a persistent totals footer showing the current sum, and Save/Cancel buttons. An "Add Fund" button sits below the last fund row.

### Mobile
Single-column list of fund rows. Each row is touch-friendly with a drag handle for reordering. The totals footer sticks above the bottom safe area. Save button is full-width at the bottom.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Fund row | Editable list item | Each row: drag handle (for sort order), Fund Name text input (required), Percentage number input (0.01–100.00, two decimal places), Delete button. The last fund in sort order is designated as the remainder-absorbing fund (a tooltip explains: "This fund absorbs any rounding remainder to ensure the total always equals the payment amount exactly"). |
| Delete button | Icon button per row | Disabled (grayed out, with tooltip) if any FundAllocation records exist for this fund: "This fund has [N] transactions and cannot be deleted. Deactivate it instead." Active (red) for funds with no transactions — clicking removes the row immediately with undo toast. |
| Add Fund button | Secondary button | Appends a new empty fund row. Focuses the Fund Name field of the new row. |
| Totals footer | Persistent footer | Shows: "Total: [X]%" Color-coded: green when exactly 100.00%; red when not 100.00%. When not 100%: message "Fund percentages must total exactly 100% before you can save." |
| Save button | Primary button | Disabled when total ≠ 100.00%. On click: triggers confirmation if existing transaction records exist (see warning state). |
| Change warning | Alert | If any transactions exist: inline warning above Save: "Existing payment allocations will not be recalculated. Only future payments will use the new allocation." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on fund rows |
| Default — no custom funds | No funds configured | Single read-only row: "General Fund — 100%" with note: "All payments go to the General Fund. Add custom funds to split payments." "Add Fund" button available to begin customizing. |
| Valid (100%) | Percentages sum to exactly 100.00% | Total footer shows "100.00%" in green; Save button enabled |
| Invalid (not 100%) | Percentages do not sum to 100.00% | Total footer shows "[X]%" in red; Save button disabled; inline message: "Fund percentages must total exactly 100%." |
| Live recalculation | Any percentage input changes | Total footer updates in real-time (no debounce — instant). |
| Cannot delete fund | Fund has existing transactions | Delete button disabled; tooltip: "This fund has [N] transactions and cannot be deleted." |
| Saving | Save clicked (valid state) | Save button shows spinner; all fields disabled |
| Saved | Save completes | Toast: "Fund allocation updated. New allocation applies to future payments." |
| Unsaved changes | Any field changed | "Unsaved changes" indicator in header |
| Cancel with changes | Cancel clicked with unsaved edits | Confirmation dialog: "Discard unsaved changes?" Confirm reverts; cancel returns to editing. |

## Interactions

- Adding a fund: clicking "Add Fund" appends a new empty row and focuses the Fund Name text input of that row. The percentage field defaults to blank (not 0) so the total footer immediately reflects that the new fund has no percentage yet and is not 100%.
- Percentage fields are validated in real time — the totals footer updates on every keystroke (no debounce). The footer turns green only when the sum is exactly 100.00%; any other value shows red. The Save button stays disabled while the total is not 100.00%.
- The last fund in sort order shows a tooltip on its percentage field: "This fund absorbs any rounding remainder to ensure the total always equals the payment amount exactly." Editing its percentage directly is allowed and immediately recalculates the live total.
- Deleting a fund with existing transactions: the delete button is disabled (grayed out) with a tooltip "Cannot delete — this fund has recorded transactions. Deactivate it instead." Deactivating a fund (via a separate "Deactivate" action) removes it from future payment allocations while preserving all historical allocation records.
- Deleting a fund with no transactions: clicking the active (red) delete button removes the row immediately and shows a 5-second undo toast. Undo restores the row with its original name and percentage.
- Fund rows can be reordered by dragging the drag handle. Reordering changes which fund is designated as the remainder-absorbing fund (the last in sort order). The remainder-absorbing tooltip moves to the new last row immediately after drop.
- If existing transaction records are present, an inline warning appears above the Save button: "Existing payment allocations will not be recalculated. Only future payments will use the new allocation." This warning is persistent (not dismissible) while transactions exist.
- Navigating away with unsaved changes triggers a "Discard unsaved changes?" confirmation dialog. Confirming reverts to the last saved state; dismissing returns to editing.
