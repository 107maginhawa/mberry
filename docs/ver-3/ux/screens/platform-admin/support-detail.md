# Support Ticket Detail

- **Route:** `/admin/support/[id]`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Support)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Provide a dedicated, deep-linkable page for a single support ticket — used when an admin navigates directly to a ticket URL or opens it from an escalation notification.

## Layout

Full-width single-ticket page (as opposed to the two-panel inbox layout). A narrow left sidebar shows org context; the main area is the full conversation thread and action panel. A back link at the top returns to the support inbox. This layout is used for direct URL access; clicking a ticket from the inbox loads the same content in the inbox's right panel.

Left column (25% width): org context panel — org name, association, org status badge, member count, last officer login date, health score, link to org detail, link to member detail for the submitting officer. Main column (75% width): ticket header, conversation thread, composers, and action bar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Back link | Navigation | "← Support Inbox" returns to `/admin/support`. |
| Ticket header | Display | Subject line (large), org name, officer name, ticket ID, created date, SLA status indicator (green/amber/red), current status badge. |
| SLA indicator | Status display | Shows "First response due: [time remaining]" or "OVERDUE: [X hrs past SLA]" in the appropriate color. Resolved tickets show "Resolved at [timestamp] — [response time] / [resolution time]." |
| Conversation thread | Thread view | Chronological messages: officer messages (right-aligned or distinctly styled), admin replies (left-aligned), internal notes (grey background, "Internal" label). Each message has: author avatar, name, role (Officer / Admin / Internal Note), timestamp, body text. |
| Reply composer | Rich text editor | Full composer with toolbar (bold, italic, list, link). "Send Reply" sends to the officer via in-app and email. Character limit: 10,000. |
| Internal note composer | Collapsible text area | Toggle "Add Internal Note" below the reply composer. Plain text. "Save Note" button. Note flagged with "Internal — not sent to officer" label. |
| Status action bar | Row of buttons | "Change Status" dropdown (Open / In Progress / Resolved / Escalated), "Assign to Me" button, "Impersonate User" button. |
| Org context panel | Left sidebar | Org name (link to org detail), Association, Status badge, Member Count, Health Score (color-coded), Last Officer Login, "View Org" link, "View Officer Profile" link. |
| Escalation section | Conditional section | Shown when status = Escalated. Notes which Super Admins were notified and when. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Thread skeleton; left panel skeleton. |
| No messages yet | Ticket just created, no reply | Thread shows only the initial officer message. Reply composer is open by default. |
| SLA breach | Response time exceeded | SLA indicator turns red and shows "OVERDUE." Banner at top of page: "This ticket has breached its SLA. All Super Admins have been notified." |
| Resolved | Status = Resolved | Status badge shows "Resolved." Conversation thread is read-only (no new composer). A note at the bottom: "This ticket was resolved on [date]. If the officer replies, it will automatically reopen." |
| Re-opened | Officer replies to resolved ticket | Status returns to "Open." New message appears in thread. Banner: "This ticket was re-opened by [officer name] on [date]." Reply composer is re-enabled. |
| Error | Fetch fails | "Could not load ticket. Retry." with retry button. Thread area shows error. |
| Send failure | Reply or note fails to save | Composer shows error inline. Text is not cleared. "Try again" button in the composer footer. |

## Interactions

- "Send Reply" triggers an in-app notification and email to the submitting officer.
- "Impersonate User" opens a new browser tab with the impersonation session for the officer, allowing the admin to replicate the officer's view while keeping the ticket open in the original tab.
- Status changes in the action bar are immediate; a confirmation toast appears. Status transitions are logged in the audit trail.
- All admin actions (replies, notes, status changes, impersonation initiation) are logged in the audit trail with the acting admin's ID and timestamp.
- "Assign to Me" sets the ticket's assigned admin; other admins see the ticket as assigned in the inbox list.
