# Event Detail (Officer)

- **Route:** `/org/[id]/officer/events/[id]`
- **Module:** M08 Events
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the Secretary a full view of a single event — complete details, registration list management, attendance stats, and edit/cancel actions.

## Layout

### Desktop
Sidebar navigation visible. Main content is a two-panel layout: a wide left column with event details and three tabs (Details / Registrations / Attendance), and a narrower right panel with event stats, quick actions (Edit, Cancel, Duplicate), and a "View Check-in" button that links to the attendance check-in screen on event day. A breadcrumb links back to the events dashboard.

### Mobile
Single column. Event header and cover image at top, then a tab bar (Details / Registrations / Attendance), then tab content. Quick actions in a "..." overflow menu in the header.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Event header | Header block | Cover image (or type-icon placeholder), event title, type badge, status badge (Published=green / Draft=gray / Cancelled=red), visibility badge (Internal / Network), date/time, location (with map link for in-person). |
| Cancellation banner | Alert banner | Shown when status = Cancelled: "This event has been cancelled. Registered members were notified." Strikethrough styling on event title. |
| Details tab | Content section | Full rich-text description rendered. Registration info: fee (if paid), capacity ("35/50"), waitlist count if any. QR check-in enabled/disabled indicator. Public page link (if enabled). |
| Registrations tab | Searchable data table | Columns: Member name (linked to roster detail), License #, Category, Registration status (Registered / Pending Payment / Waitlisted / Cancelled), Payment status (Paid / Pending / N/A), Registration date. Search by name. Filter by status. "Send Payment Reminder" button for members in Pending Payment status. |
| Attendance tab | Summary + link | Counts: Total registered, Total checked in, Check-in rate %. Method breakdown (QR vs Manual). "Open Check-in Screen" button links to `/org/[id]/officer/events/[id]/attendance` (active on event day; shown as "Check-in opens on [date]" before event day). Export attendance as CSV button. |
| Edit button | Secondary button | Opens event edit form pre-populated with current data. Only available when status = Draft or Published (not Cancelled). |
| Cancel event button | Destructive button | Opens confirmation dialog: "Cancel this event? All N registered members will be notified. This action cannot be undone." Cancelled events remain visible with strikethrough styling. |
| Duplicate button | Secondary button | Creates a draft copy of the event with all fields pre-filled. Redirects to create-event form. |
| View Check-in button | Primary button (event day only) | Active only on the event's start date. Links to `/org/[id]/officer/events/[id]/attendance`. Before event day: "Check-in opens on [date]" (disabled). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on header and tabs |
| Draft | status = draft | Yellow "Draft" badge; Edit and Publish actions visible; no registrations yet |
| Published | status = published | Green "Published" badge; Registrations tab populated; all actions available |
| Event day | Start date = today | "View Check-in" button activates with green highlight |
| Cancelled | status = cancelled | Red "Cancelled" badge; cancellation banner; Edit and Cancel buttons hidden; Duplicate still available |
| Waitlist exists | Capacity full, waitlist members exist | Registrations tab shows waitlist section below confirmed registrants; waitlist count in header |
| Error: not found | Invalid event ID | "Event not found." with link back to events dashboard |
| Cancel confirmation | Cancel button clicked | Modal dialog: requires explicit confirm; typing "CANCEL" not required but a clear destructive confirm button |
| After cancel | Cancel confirmed | Page refreshes; status badge changes to Cancelled; toast: "Event cancelled. N members notified." |

## Interactions

- Tab switching (Details / Registrations / Attendance) is immediate with no page load. The active tab is preserved in the URL hash so refreshing or sharing the link deep-links to the same tab.
- In the Registrations tab, searching by member name triggers after 300ms debounce. Status filter applies immediately on selection. "Send Payment Reminder" button sends reminders to all members currently in Pending Payment status and shows a toast: "Payment reminders sent to N members."
- Clicking a member's name in the Registrations tab navigates to that member's roster detail page.
- "Edit" button navigates to the event edit form pre-populated with existing data. Disabled when status = Cancelled.
- "Cancel event" button opens the confirmation dialog. Clicking "Confirm" in the dialog cancels the event, updates the status badge in place, shows the cancellation banner, and displays a toast with the number of members notified. "Cancel" in the dialog dismisses without action.
- "Duplicate" creates a draft copy and redirects to the create-event form pre-filled. No confirmation required.
- "Open Check-in Screen" in the Attendance tab is active only on the event's start date. Clicking it on event day navigates to `/org/[id]/officer/events/[id]/attendance`. Before event day the button displays "Check-in opens on [date]" and is disabled.
- "Export attendance as CSV" in the Attendance tab triggers an immediate download of the attendance list (members with check-in times and method). If no one has checked in the download contains headers only with a note row.
- Breadcrumb "Events" link navigates back to `/org/[id]/officer/events` without a confirmation dialog even if no unsaved changes are present.
