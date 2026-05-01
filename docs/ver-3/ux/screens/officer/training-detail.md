# Training Detail (Officer)

- **Route:** `/org/[id]/officer/training/[id]`
- **Module:** M09 Training
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the Secretary a full view of a single training program — details, enrollment management, attendance/completion status, analytics, and edit/cancel actions.

## Layout

### Desktop
Sidebar navigation visible. Main content is a two-panel layout: a wide left column with training details and four tabs (Details / Enrollments / Attendance / Analytics), and a narrower right panel with training stats, quick actions (Edit, Cancel, Duplicate), and a "View Attendance" button. A breadcrumb links back to the training dashboard.

### Mobile
Single column. Training header and cover image at top, then a tab bar (Details / Enrollments / Attendance / Analytics), then tab content. Quick actions in a "..." overflow menu in the header.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Training header | Header block | Cover image (or type-icon placeholder), title, type badge, credit value badge (prominent, e.g., "5 CPD"), approval status badge, status badge (Published / Draft / Cancelled / Pending Approval), visibility badge (Network / Internal), date(s), location. |
| Pending Approval banner | Yellow banner | Shown when network_approval_status = pending: "Awaiting network approval. Training is not yet visible to members." |
| Approval rejected banner | Red banner | Shown when rejected: "Network approval rejected. Reason: [feedback]." Edit and resubmit option. |
| Cancelled banner | Red banner | "This training has been cancelled. Enrolled members were notified. Any already-awarded credits were not revoked." |
| Details tab | Content section | Full rich-text description. Schedule (single or multi-session). Regulatory approval reference if approved. Enrollment mode, fee, capacity. Public page link if enabled. |
| Enrollments tab | Searchable data table | Columns: Member name (linked to roster detail), Org (for network enrollees), Enrollment date, Status badge (Enrolled / Pending Approval / Pending Payment / Waitlisted / Completed / Cancelled), Payment status. Search by name. Filter by status. For approval-required mode: Approve and Reject buttons per pending row with reject reason input. "Bulk Approve" button for multiple pending rows. "Send Payment Reminder" for Pending Payment members. Capacity progress bar: "35/50 enrolled." |
| Attendance tab | Stats + link | For single-session: "Open Attendance Screen" button links to `/org/[id]/officer/training/[id]/attendance` (active on training day). For multi-session: shows completion table inline with "Mark Complete" per member and bulk select. Attendance stats: enrolled, completed, completion rate %, total credits issued. Export attendance as CSV. |
| Analytics tab | Metrics dashboard | Enrollment over time (line chart), enrollment by source org (if network-wide), completion rate, total credits awarded, revenue (if paid) with online vs manual breakdown. All metrics exportable as CSV. Empty state: "Analytics will be available once members start enrolling." |
| Edit button | Secondary button | Opens training edit form pre-populated. Disabled when status = Cancelled. |
| Cancel training button | Destructive button | Confirmation dialog: "Cancel this training? All N enrolled members will be notified. Credits already awarded will not be automatically revoked." If credits have been awarded: additional warning: "N members have already received credits. Manual credit correction via the credit tracking module will be required if needed." |
| Duplicate button | Secondary button | Creates a draft copy with all fields pre-filled. Redirects to create-training form. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on header and tab content |
| Draft | status = draft | Gray "Draft" badge; no enrollments; Edit and Publish actions available |
| Pending approval | network_approval_status = pending | Yellow pending banner; training not visible to members; Edit available to update and resubmit |
| Rejected | network_approval_status = rejected | Red rejection banner with feedback text; Edit to revise; Resubmit button |
| Published | status = published | Full detail visible; all tabs populated |
| Training day | start_date = today (single-session) | "Open Attendance Screen" button activates with green highlight in Attendance tab |
| Cancelled | status = cancelled | Red cancelled banner; Edit/Cancel buttons hidden; Duplicate still available |
| Credit value locked | Any attendance confirmed | Credit value in Details tab shows lock icon; tooltip: "Credit value is locked after first attendance confirmation." |
| Error: not found | Invalid training ID | "Training not found." with link back to training dashboard |
| After approval action | Enrollment approved/rejected | Row updates status; toast: "[Name] enrollment approved." or "[Name] enrollment rejected." |

## Interactions

- Tab switching (Details / Enrollments / Attendance / Analytics) is immediate with no page reload. The active tab is preserved in the URL hash so deep-linking and refreshing land on the same tab.
- In the Enrollments tab, member name search triggers after 300ms debounce. Status filter dropdown applies immediately on selection. Both filters compound.
- Clicking a member's name in the Enrollments tab navigates to that member's roster detail page (opens in the same tab; breadcrumb returns to this training detail).
- For approval-required trainings: "Approve" and "Reject" buttons appear per pending-enrollment row. Clicking "Approve" immediately updates the row status to Enrolled (optimistic update) and sends the member a notification. Clicking "Reject" opens an inline text input for a rejection reason (required) before confirming — on confirm the row moves to Rejected status. "Bulk Approve" selects all visible pending rows and requires a single confirmation dialog ("Approve N enrollment requests?") before processing.
- "Send Payment Reminder" button in the Enrollments tab is active only when one or more members are in Pending Payment status. Clicking it sends reminders to all such members and shows a toast with the count sent.
- "Open Attendance Screen" in the Attendance tab is active only on the training's start date (single-session). Clicking it navigates to `/org/[id]/officer/training/[id]/attendance`. Before the start date it is disabled with a "Attendance opens on [date]" label.
- For multi-session trainings, "Mark Complete" and bulk completion are available inline in the Attendance tab without navigating away. Each bulk action requires confirmation before processing (see training-attendance.md for detail).
- "Edit" button navigates to the training edit form. Credit value field appears with a lock icon if any attendance has been confirmed (M9-R2) — the officer can see the value but cannot change it.
- "Cancel training" opens a confirmation dialog. If credits have already been awarded, the dialog includes an additional warning about manual credit correction. Confirm cancels the training, updates the status badge in place, and shows a toast. The dialog's Cancel button dismisses without action.
- "Export attendance as CSV" in the Attendance tab triggers an immediate file download. Available at any time once any attendance or completion data exists.
