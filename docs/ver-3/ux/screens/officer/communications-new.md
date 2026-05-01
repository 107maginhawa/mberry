# Compose Announcement

- **Route:** `/org/[id]/officer/communications/new`
- **Module:** M07 Communications
- **Access:** Officer (any role)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets an officer write, configure, preview, and publish or schedule a rich-text announcement to org members.

## Layout

### Desktop
Sidebar navigation visible. Main content is a split two-column view: the left column holds the rich-text editor and configuration controls; the right column holds a live preview panel that updates as the officer types, with a toggle to switch between "In-app" and "Email" preview modes.

### Mobile
Single-column layout. Editor occupies the full width at the top. Audience, channel, and visibility controls stack below. Preview is accessible as a bottom sheet via a "Preview" button — it does not persist on screen. Action buttons (Save Draft / Schedule / Publish Now) are sticky at the bottom.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Rich text editor | Tiptap editor | Toolbar: Heading (H1/H2/H3), Bold, Italic, Underline, Bullet list, Numbered list, Link, Image upload, Blockquote. Placeholder text: "Write your announcement here..." Auto-saves draft every 30 seconds. Image upload: drag-and-drop or click; max 5 MB; JPEG/PNG/WebP; upload failure shows inline error "Upload failed. Max 5 MB, JPEG/PNG/WebP only." All content sanitized on save (per M7-R2): script tags, event handlers, iframes stripped. |
| Audience selector | Radio group + checkboxes | "All members" (default) or "By category" — if by category, shows checkboxes for each active org category. If "By category" is selected with no matching members: inline warning "No recipients in the selected categories." |
| Channel toggles | Toggle row | In-app (always on, toggle absent — cannot disable per M7-R7), Push (toggle, default on), Email (toggle, default off). If Email is toggled on, the preview panel switches to email preview mode and an email template preview is shown. |
| Visibility selector | Radio | Internal (default, chapter-only) / Network-wide (shared to other orgs' feeds per M7 cap 7.9). |
| Live preview panel | Preview pane (desktop) | Renders the announcement as members will see it. Toggle between "In-app view" and "Email view". Updates in near-real-time as the editor content changes (debounced 500ms). |
| Schedule date/time picker | Date + time picker | Appears when "Schedule" is clicked. Validates that selected time is at least 15 minutes in the future. Displays org timezone. Past date shows inline error: "Schedule time must be in the future." |
| Action buttons | Button group | "Save Draft" (saves without publishing), "Schedule" (opens date/time picker, saves with Scheduled status), "Publish Now" (publishes immediately). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Empty | New compose | Editor shows placeholder text; no preview content yet |
| Editing | Officer types | Auto-save every 30 seconds; "Saved" indicator appears briefly in the toolbar |
| Validation error: blank content | Publish/Schedule clicked with empty editor | Inline error: "Content cannot be empty." Publish/Schedule buttons remain disabled until content is added. |
| Validation error: no recipients | By-category audience with no members | Inline warning: "No recipients. Select a different audience." Publish button disabled. |
| Publishing | Publish Now clicked | Spinner on button; "Sending to N members..." label below button; editor disabled |
| Published | Publish completes | Redirect to announcement detail at `/org/[id]/officer/communications/[id]` with success toast: "Announcement sent to N members." |
| Publish failed | API error | Toast (error): "Failed to send announcement. Your draft has been saved." Buttons re-enabled for retry. |
| Scheduled | Schedule confirmed | Redirect to communications dashboard; card for this announcement shows "Scheduled" status with countdown to publish time. |
| Image upload in progress | Image dragged or selected | Progress bar inside the editor at image insertion point |
| Image upload failed | File too large or wrong type | Inline error below the image drop zone: "Image upload failed. Max 5 MB, JPEG/PNG/WebP only." |

## Interactions

- The rich text editor auto-saves draft content every 30 seconds. A "Saved" indicator appears briefly in the toolbar on each auto-save. If the officer navigates away without saving or publishing, a browser-level "Leave page?" dialog appears to prevent accidental content loss.
- Image upload (drag-and-drop or click): non-JPEG/PNG/WebP files are rejected immediately with the inline error before hitting the server. Files within the 5 MB limit are uploaded asynchronously — a progress bar appears at the image insertion point. Upload success inserts the image inline into the editor. Clicking elsewhere in the editor while an upload is in progress does not cancel the upload.
- Audience selector: selecting "By category" reveals category checkboxes. Checking/unchecking categories updates the estimated recipient count shown below the selector (e.g., "~47 recipients") in real time. If all category checkboxes are unchecked after selecting "By category," the "Publish Now" button becomes disabled and shows the warning "No recipients. Select a different audience."
- Channel toggles affect the live preview panel immediately: toggling Email on switches the right-side preview to email template view; toggling it off returns to the in-app view. The In-app channel has no toggle (it is always on per M7-R7).
- Visibility selector switching from "Internal" to "Network-wide" shows an informational tooltip: "This announcement will appear in member feeds of other orgs in the network."
- "Save Draft" saves immediately and shows a toast "Draft saved." The URL updates to `/org/[id]/officer/communications/[id]` so the draft can be bookmarked or returned to. No redirect.
- "Schedule" button: clicking opens the date/time picker inline (not a modal). The picker validates on change — selecting a past time disables the "Confirm Schedule" button and shows "Schedule time must be in the future." Selecting a valid time at least 15 minutes out enables "Confirm Schedule." Confirming redirects to the communications dashboard; the new card appears in the Scheduled tab with a countdown timer.
- "Publish Now" is disabled if the editor content is empty or if there are no recipients in the selected audience. Clicking it while valid shows the spinner immediately and posts the announcement. On success, redirect to `/org/[id]/officer/communications/[id]` with toast "Announcement sent to N members." On failure, toast "Failed to send announcement. Your draft has been saved." — the draft is preserved and buttons re-enable for retry.
