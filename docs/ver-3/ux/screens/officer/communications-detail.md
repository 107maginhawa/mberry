# Communication Detail

- **Route:** `/org/[id]/officer/communications/[id]`
- **Module:** M07 Communications
- **Access:** Officer (any role)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show a single announcement in full — its complete rich-text content plus delivery statistics — so officers can review what was sent, track engagement, and take follow-up actions (resend, archive, or continue editing if it is still a draft or scheduled).

## Layout

### Desktop

Sidebar navigation visible. Main content is a two-column layout: a wide left column (two-thirds) renders the announcement content and metadata, and a narrower right column (one-third) shows the delivery stats panel and action buttons. A breadcrumb at the top links back to the Communications Dashboard.

### Mobile

Single-column scroll. Announcement content and metadata first, delivery stats below as a card section, action buttons (Resend / Archive) at the bottom as a sticky footer bar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | "Communications / [Announcement Title]" — "Communications" links back to `/org/[id]/officer/communications`. |
| Announcement header | Header block | Announcement title (h1), status badge (Sent=green / Scheduled=yellow / Draft=gray / Scheduled Failed=red), published date and time (or scheduled time for Scheduled status, or "Not yet published" for Draft). |
| Announcement metadata | Detail list | Author (officer name), audience (All members or list of selected membership categories), channels used (In-app / Push / Email icons, each checked or unchecked), visibility (Internal or Network-wide). |
| Announcement body | Rich text render | The full announcement content rendered as HTML (same formatting as members see in their notification center): headings, bold/italic, bullet and numbered lists, inline images, links, blockquotes. Read-only. |
| Delivery stats panel | Stat cards | Five metrics displayed as labeled cards: **Recipients** (total members in the target audience at send time), **In-app views** (members who opened the notification in-app), **Push delivered** (successful push deliveries), **Email sent** (emails dispatched, only if email channel was used), **Email opened** (tracked opens via pixel, only if email channel was used). Stats refresh in near-real-time for sent announcements. A note below stats: "Open rates reflect members who did not block image loading. Individual member read status is not shown." |
| Read rate indicator | Progress bar + percentage | Visual read rate: in-app views / recipients. Labeled "Read rate." |
| "Resend" button | Secondary button | Visible only when status = Sent. Opens a confirmation dialog: "Resend this announcement to all original recipients? Members who already received it will receive it again." Confirming queues a new delivery. |
| "Archive" button | Tertiary / ghost button | Visible for all statuses. Confirmation dialog: "Archive this announcement? It will be removed from the active list and moved to archived communications." Archived announcements remain accessible via filter on the dashboard. |
| "Edit" button | Secondary button | Visible when status = Draft or Scheduled. Navigates to the compose editor (`/org/[id]/officer/communications/new` pre-populated with this announcement's content). |
| "Cancel Schedule" button | Destructive secondary button | Visible only when status = Scheduled. Confirmation dialog: "Cancel this scheduled announcement? It will move to Drafts and will not be sent." |
| "Publish Now" button | Primary button | Visible only when status = Draft or Scheduled Failed. Sends the announcement immediately to all configured recipients. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on the header, body, and stats panel. |
| Sent | status = sent | Full content render (read-only). Live delivery stats. "Resend" and "Archive" buttons visible. |
| Scheduled | status = scheduled | Content render (read-only preview). Metadata shows scheduled date/time and countdown ("Sends in 2 days, 4 hours"). Stats panel shows "--" for all metrics (not yet sent). "Edit," "Cancel Schedule," and "Archive" buttons visible. |
| Draft | status = draft | Content render (read-only preview). Stats panel shows "--" for all metrics. "Edit," "Publish Now," and "Archive" buttons visible. |
| Scheduled Failed | status = scheduled_failed | Red status badge. Banner: "Scheduled send failed after 3 retries. Please publish manually." "Publish Now" and "Archive" buttons visible. |
| Resend submitting | "Resend" confirmed | Spinner on button; brief "Sending…" toast. On success: "Announcement resent to N members." |
| Archive success | "Archive" confirmed | Toast: "Announcement archived." Redirect back to Communications Dashboard. |
| Cancel schedule success | "Cancel Schedule" confirmed | Toast: "Schedule cancelled. Announcement moved to Drafts." Status badge updates to Draft. |
| Publish success | "Publish Now" confirmed | Toast: "Announcement sent to N members." Status badge updates to Sent. Stats panel activates. |
| Error: not found | Invalid announcement ID or wrong org | "Announcement not found." with link back to Communications Dashboard. |
| Error: load failure | API fetch fails | "Unable to load this announcement. Please try again." Retry button shown. |

## Interactions

- Delivery stats (In-app views, Push delivered, Email sent, Email opened) update without requiring a page refresh for recently sent announcements. Stats settle within a few minutes of delivery completion.
- The read rate indicator is based on in-app views divided by recipients. It does not reflect individual members — per M7-R5, individual read/open status is never shown to officers.
- Email open tracking uses a standard pixel. Members who block images in email will not be counted as opened — this is noted below the stats panel.
- "Resend" is intentionally a secondary (not primary) action to reduce accidental duplicate sends. It requires a confirmation dialog.
- If the announcement was sent to "By category" rather than "All members," the recipients count reflects only members in the selected categories at the time of the original send.
- On mobile, the sticky footer shows the two most contextually relevant actions based on status: for Sent announcements, "Resend" and "Archive"; for Drafts, "Edit" and "Publish Now"; for Scheduled, "Edit" and "Cancel Schedule."
- Navigating back from the compose editor after editing a draft or rescheduled announcement returns to this detail page (not the dashboard) to preserve context.
