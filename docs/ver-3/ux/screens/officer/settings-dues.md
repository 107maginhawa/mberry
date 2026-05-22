# Dues Configuration

- **Route:** `/org/[id]/officer/settings/dues`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Treasurer set dues amounts, billing frequency, grace period, due date, per-category overrides, and the automated reminder schedule for the org.

## Layout

### Desktop
Sidebar navigation visible. Main content is a single scrollable settings page with three labeled sections: Default Dues, Per-Category Overrides, and Reminder Schedule. "Save" and "Cancel" buttons appear at the top-right and again at the bottom of the page.

### Mobile
Single-column form. Sections stack vertically with section headers as dividers. Sticky "Save" button at the bottom.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Default Amount | Currency input | Required. Must be > 0. Two decimal places. Example placeholder: "PHP 1,500.00". |
| Billing Frequency | Select | Annual / Quarterly. Changing frequency adjusts which due-date field is shown below. |
| Due Date | Month/Day picker (annual) or Day-of-quarter picker (quarterly) | For annual: month dropdown + day input (e.g., "January 1"). For quarterly: day-of-month when each quarter's dues are due. Required. |
| Grace Period | Number input | Days (0–365). Default: 30. Helper text: "Members have this many days after their due date before status changes to Lapsed." Out-of-range value shows inline error: "Grace period must be 0–365 days." |
| Per-Category Overrides table | Editable table | Rows for each active org category. Columns: Category name, Default Amount (read-only, inherited from default), Override Amount (editable text input — blank = use default). Life category row is shown as "N/A — Life members are exempt from dues." Inactive categories are hidden. |
| Reminder Schedule table | Toggle table | Rows for each default trigger (per M6-R5): Pre-expiry 60 days, Pre-expiry 30 days, Pre-expiry 7 days, Day of expiry, Post-expiry 7 days, Post-expiry 30 days. Columns: Trigger label, Days value (read-only for defaults, editable for custom), Enabled toggle, Channels (checkboxes: In-app always checked and locked, Push, Email). "Add custom reminder" button appends a new editable row with a days field (negative = before expiry, positive = after). |
| Save button | Primary button | Saves all three sections. Success toast: "Dues configuration updated. Applies to future billing cycles." Existing members' current terms are unaffected. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on all form sections |
| First setup | No dues config exists | All fields empty except defaults pre-filled. Guided intro text: "Set up your dues structure to start collecting membership dues." |
| Editing | Any field changed | "Unsaved changes" indicator in header; Save/Cancel buttons active |
| Saving | Save clicked | Save button shows spinner; all fields disabled |
| Saved | Save completes | Success toast: "Dues configuration updated. Applies to future billing cycles." |
| Validation error: amount | Amount = 0 or blank | Inline error: "Amount must be greater than 0." Save blocked. |
| Validation error: grace period | Value outside 0–365 | Inline error: "Grace period must be 0–365 days." Save blocked. |
| Cancel | Cancel clicked with unsaved changes | Confirmation dialog: "Discard unsaved changes?" Confirm reverts form; cancel returns to editing. |

## Interactions

- Changing the Billing Frequency selector between Annual and Quarterly immediately swaps the Due Date field: Annual shows a month + day picker; Quarterly shows a day-of-month field. Any previously entered due date value is cleared on frequency change.
- Grace period is validated on blur. Entering a value outside 0–365 shows the inline error immediately and marks the Save button as disabled until corrected.
- Per-Category Overrides table: each Override Amount field is validated on blur. Entering a non-numeric or negative value shows an inline error on that field. Leaving an override field blank is valid and means "use default amount" — no error is shown for blank overrides.
- The Reminder Schedule table's In-app channel checkbox is always checked and disabled (it cannot be turned off per M6-R10). Push and Email checkboxes are independently toggleable per reminder row.
- "Add custom reminder" appends a new row with blank Days field and defaults of In-app enabled, Push and Email enabled. The Days field accepts negative integers (before expiry) and positive integers (after expiry). Entering 0 is not allowed — inline error: "Days must be non-zero."
- Removing a custom reminder row: a delete icon per custom row removes it immediately with an undo toast ("Reminder removed. Undo"). The undo is available for 5 seconds. Default reminder rows cannot be deleted — only toggled off via the Enabled toggle.
- Saving applies all three sections (Default Dues, Per-Category Overrides, Reminder Schedule) in a single request. On success, a toast confirms: "Dues configuration updated. Applies to future billing cycles." Existing members' current terms are not recalculated.
- Navigating away with unsaved changes (via sidebar or breadcrumb) triggers a "Discard unsaved changes?" dialog. Confirming discards all changes; dismissing returns to the form.
