# Member Detail

- **Route:** `/org/[id]/officer/roster/[id]`
- **Module:** M05 Membership
- **Access:** Officer (any role)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives officers a full profile view of an individual member — contact info, membership status, dues history, engagement metrics, and all actions available for that member.

## Layout

### Desktop
Sidebar navigation visible. Main content area is a two-column layout: a wide left column for member details organized in stacked sections, and a narrower right column for quick actions and engagement summary. A breadcrumb trail at the top links back to the roster.

### Mobile
Single-column scroll. Profile header at top, then sections stack vertically. Quick-action buttons move into a sticky bottom bar or a "Actions" accordion at the top.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Profile header | Header block | Member photo (or initials placeholder), full name, license number, category badge, status badge (color-coded: Active=green, Grace=yellow, Lapsed=red, Suspended=gray, Pending=blue). |
| Status warning banner | Contextual banner | Grace: "Dues expired [date]. Grace period ends [date]. [N days] remaining." (yellow). Lapsed: "Member is lapsed. Record payment to reinstate." with link to record payment (red). Suspended: "Suspended on [date]. Reason: [text]." with "Lift Suspension" button (gray). |
| Contact Information | Detail section | Email, phone, address. Always visible to officers regardless of member privacy settings (per M5-R4). |
| Membership Info | Detail section | Category, joined date, dues expiry date, status history (timeline of state transitions). |
| Dues History | Data table | Columns: Date, Amount, Method (Online/Cash/Check/Bank Transfer/GCash/Other), Status badge, Receipt download icon. Sortable by date, filterable by method and status. |
| Engagement | Summary cards | Last login (date or "Never"), events attended count, trainings attended count, engagement score. "At risk" label if engagement score is low. |
| Actions panel | Button group | Change Category (opens category selector); Record Payment (links to payments-new with member pre-selected); Initiate Transfer (opens transfer workflow); Disciplinary Action (links to disciplinary form on this screen — President only); Resend Claim Email (visible only when status is Pending Verification). |
| Disciplinary Action form | Inline form (President only) | Radio: Warn / Suspend / Remove. Reason textarea (required, non-empty). Submit triggers a confirmation dialog specific to the action type before posting. |
| Action History table | Data table | Date, Action (Warn/Suspend/Remove), Reason, Performed By. Shown only if disciplinary actions exist. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on all sections |
| Active member | Status = Active | Green status badge; no warning banner; all actions available |
| Grace member | Dues expired, within grace period | Yellow status banner with expiry and grace-end date |
| Lapsed member | Grace period expired | Red banner with "Record payment to reinstate" CTA |
| Suspended member | Officer disciplinary action | Gray banner with reason and "Lift Suspension" button |
| Pending Verification | Imported but not claimed | Blue badge; "Resend Claim Email" button visible |
| Error: member not found | Invalid ID in route | "Member not found." with link back to roster |
| Success: action recorded | Disciplinary action submitted | Toast: "Action recorded. [Member] has been notified." Form resets. |
| Error: empty reason | Disciplinary submit with blank reason | Inline error: "Reason is required." Form not submitted. |

## Interactions

- Breadcrumb "Roster" link at the top navigates back to `/org/[id]/officer/roster`, preserving any filters that were active when the officer entered this page (filters are passed as query params on navigation).
- "Record payment" CTA in the status warning banner (for Lapsed members) navigates to `/org/[id]/officer/payments/new` with this member pre-selected in the member search field — no re-typing required.
- "Lift Suspension" button on the suspended banner opens a confirmation dialog: "Lift suspension for [Member Name]? Their access will be restored." Cancel dismisses. Confirm posts the change and reloads the page with the updated status badge and no suspension banner.
- "Change Category" in the actions panel opens a category selector modal listing all active org categories. Selecting a new category shows a confirmation: "Change [Member Name] to [New Category]?" Confirm posts the change; the category badge in the profile header updates immediately on success. Toast: "Category updated."
- "Resend Claim Email" (visible for Pending Verification members) opens a small confirmation: "Resend claim email to [email]?" Confirm sends the email and shows toast "Claim email sent." The button is temporarily disabled for 60 seconds to prevent repeat sends.
- Disciplinary action form (President only): selecting a radio option (Warn / Suspend / Remove) does not immediately do anything — the officer must also fill in the reason textarea and click Submit. Clicking Submit with an empty reason shows inline error "Reason is required." and does not open the dialog. Clicking Submit with a valid reason opens a confirmation dialog specific to the action type; Cancel returns to the form with the reason preserved; Confirm posts the action, closes the dialog, and shows toast "Action recorded. [Member] has been notified." The form resets (radio deselected, reason cleared) after success.
- Dues History table rows: clicking the receipt download icon in a row downloads the PDF for that payment directly — no navigation away from the page.
- "Initiate Transfer" opens a transfer workflow modal: officer selects the destination org from a searchable dropdown, adds an optional note, and submits. The receiving org admin must approve before the transfer finalizes. Toast on submit: "Transfer request sent to [Org Name]."
