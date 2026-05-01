# Support Inbox

- **Route:** `/admin/support`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Support)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give support operators a prioritized inbox of all open support tickets from org officers, with SLA tracking and a two-panel layout for reading and responding without leaving the list.

## Layout

Two-panel layout filling the full width. Left panel (approximately 35% width): ticket list with priority color indicators, SLA countdown timers, and filter controls at the top. Right panel (approximately 65% width): selected ticket detail with conversation thread, internal notes, and action buttons. A metrics bar above both panels shows aggregate SLA health for the support team. No outer left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| SLA metrics bar | Top bar | Four stats: Average First Response Time, Average Resolution Time, Open Ticket Count, SLA Compliance Rate (%). Updated in near-real-time. |
| Filter bar (left panel) | Filters | Status (All / Open / In Progress / Resolved / Escalated), Priority (All / High / Standard), Date range. |
| Ticket list | List | Each ticket card: left color bar (red = High, grey = Standard), subject line, org name + officer name, status badge, SLA timer (green = healthy, amber = < 2 hrs remaining, red = overdue labeled "OVERDUE: [X hrs past SLA]"), created date. Sorted by: High priority first, then oldest first within each priority level. |
| Ticket card | Clickable card | Clicking a card loads its detail in the right panel and highlights the card. |
| Ticket detail: header | Right panel header | Ticket subject, org name (linked to org detail), officer name (linked to member detail), ticket ID, created date, current status badge, assigned admin (if any). |
| Ticket detail: conversation | Thread view | Chronological message thread alternating between officer messages and admin replies. Each message: avatar, name, timestamp, body. Internal notes appear with a grey background and a "Internal — visible to admin team only" label. |
| Reply composer | Rich text editor | Opens inline below the thread when "Reply" is clicked. Toolbar: bold, italic, bullet list, link. "Send Reply" button. Sent via in-app notification and email to the officer. |
| Internal note composer | Text area | Opens when "Add Note" is clicked. Plain text. "Save Note" button. Note is not sent to the officer. |
| Status selector | Dropdown | Open, In Progress, Resolved, Escalated. Status change takes effect immediately on selection with a confirmation toast. |
| "Impersonate User" button | Button | Launches impersonation for the ticket's submitting officer (Super/Support only). Opens the impersonation confirmation dialog. |
| "Assign to me" button | Button | Assigns the open ticket to the current admin. Shown when ticket is unassigned. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Left panel: list skeleton. Right panel: "Select a ticket to view details." |
| Empty inbox | No tickets match current filter | Left panel: "No support tickets. All quiet on the support front." Right panel: empty with same message if no ticket is selected. |
| Ticket selected | Ticket card clicked | Right panel populates with ticket detail; card highlighted in list. |
| SLA breach | First response time exceeded (4 hrs business hours for High; standard SLA for others) | Ticket card turns fully red. Timer label changes to "OVERDUE: [X hrs past SLA]." Auto-escalation: all Super Admins receive an in-app and email notification. |
| Reply sending | "Send Reply" clicked | Reply button shows spinner; composer disabled. On success: message appears in thread, officer notified. On failure: error message, text preserved in composer. |
| Ticket re-opened | Officer replies to a Resolved ticket | Ticket status automatically changes to "Open." Ticket moves back to the top of the list sorted by its re-open timestamp. Admin receives a notification. |
| Error | Thread or list fetch fails | Error message in the affected panel with a retry button. |

## Interactions

- Clicking a ticket card loads its detail in the right panel without navigating away; URL updates to `/admin/support/[id]` for deep-linking.
- Reply failures preserve the composer text; the admin does not lose their draft.
- "Impersonate User" launches the impersonation session (PA-6) in a new browser tab so the admin can reference the ticket in the original tab while impersonating.
- SLA countdown timers update in real time; no page refresh needed.
- When a ticket is resolved, the status badge in the list updates and the ticket moves to the bottom of the active view (or out of the list if the filter is set to "Open only").
