# Application Queue

- **Route:** `/org/[id]/officer/applications`
- **Module:** M05 Membership
- **Access:** Officer (any role)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets officers review, approve, reject, or request more information from pending membership applications submitted through the org's public page.

## Layout

### Desktop
Sidebar navigation visible. Main content is a list of application cards sorted oldest-first (most urgent first). A bulk-action toolbar sits above the list when applications are selected. A count badge in the sidebar nav item shows the number of pending applications.

### Mobile
Full-width scrollable list of application cards. Bulk selection via "Select" mode toggle in the header. Individual application cards are tap-expandable to reveal the full applicant details and action buttons.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Application card | Expandable card | Collapsed: applicant name, email, license #, requested category, date applied. Expanded: also shows specialization, any message from applicant. Actions: Approve, Reject, Request More Info. |
| Approve button | Primary action | Immediately creates the member, triggers welcome email, and generates a dues invoice for the selected category. Card is removed from the queue on success. |
| Reject button | Destructive action | Opens a reject reason text area (optional). On confirm: applicant is notified with reason text (or generic "application rejected" if reason is blank). Card removed from queue. |
| Request More Info button | Secondary action | Opens a text input for the officer's message. On send: applicant receives email with the officer's question. Application status changes to "Info Requested" and remains in queue with an "Awaiting response" label. |
| Bulk select | Checkbox per card + header checkbox | Select multiple applications. "Approve Selected" bulk action appears in toolbar. On confirm: "Approve N applications?" — all approved simultaneously. Applications with validation issues are skipped and listed in an error summary. |
| Filter / sort controls | Toolbar | Sort by: Date applied (oldest first, default), Name. Filter by: Category requested. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on card list |
| Empty | No pending applications | "No pending applications." with a calm illustration — no CTA needed |
| Populated | Applications exist | Sorted list of cards; pending count badge in sidebar |
| After approve | Single application approved | Card fades out; toast: "[Name] approved and added to roster." |
| After reject | Single application rejected | Card fades out; toast: "[Name] rejected. Notification sent." |
| After request info | Info requested | Card status changes to "Awaiting response" label; card remains in list |
| After bulk approve | Multiple approved | Cards removed; toast: "N applications approved." Any skipped listed inline: "[Name] could not be approved: [reason]." |
| Error: approve failed | API error on approve | Toast (error): "Failed to approve [Name]. Try again." Card remains. |

## Interactions

- Application cards are collapsed by default showing name, email, license number, requested category, and date applied. Clicking anywhere on the collapsed card expands it to reveal specialization, any applicant message, and the three action buttons. Clicking again collapses it. Only one card can be expanded at a time on mobile; multiple can be expanded simultaneously on desktop.
- "Approve" button on an expanded card acts immediately — no dialog. The card fades out of the list and a toast appears: "[Name] approved and added to roster." If the API call fails, the card reappears and an error toast shows.
- "Reject" button opens a reason text area inline within the card (not a modal). Reason is optional — leaving it blank sends a generic rejection notice; filling it in includes the text in the member's notification. "Confirm Reject" button below the text area finalizes the rejection. "Cancel" collapses the text area without rejecting.
- "Request More Info" button opens an inline text input within the card for the officer's question. The message is required — "Send" is disabled if the field is empty. On send, the application status label changes to "Awaiting response" and the three action buttons are replaced by a single "Awaiting response" label. The card stays in the list.
- Bulk selection: clicking the header checkbox selects all visible cards on the current page. "Approve Selected" opens a confirmation dialog: "Approve N applications? Members will be added to the roster and sent a welcome email." Cancel returns to selection. Confirm fires all approvals simultaneously. Cards that fail validation are listed in a summary below the toast: "[Name] could not be approved: [reason]."
- Sort and filter controls apply instantly — no "Apply" button. Changing the sort order re-orders the list immediately. Changing the category filter narrows the list to applications requesting that category only.
- The pending count badge in the sidebar nav decrements in real time as applications are approved, rejected, or moved to "Awaiting response." It reaches zero when the queue is empty and disappears.
