# Create Event

- **Route:** `/org/[id]/officer/events/new`
- **Module:** M08 Events
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Secretary create and publish a new org event — type, details, registration configuration, and visibility — with a live preview before publishing.

## Layout

### Desktop
Sidebar navigation visible. Main content is a multi-section form with four labeled sections (Basic Info, Date & Location, Registration, Visibility) visible simultaneously, with a sticky side panel showing a live preview of the event as members will see it. "Save Draft" and "Publish" buttons anchor the bottom of the form.

### Mobile
Stepped single-column form: one section per step with a progress indicator (1 of 4, etc.). Live preview accessible as a bottom sheet via a "Preview" button on the last step. Navigation: "Next" / "Back" buttons between steps.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Type selector | Dropdown | The 8 platform-defined event types with icon + label per option: General Assembly, Induction Ceremony, Fellowship/Social, Medical/Dental Mission, Board Meeting, Committee Meeting, Fundraiser, Other. Types are immutable platform-level options (M8-R2); no custom types allowed. |
| Title input | Text input | Required. Max 200 characters. Character counter shown at 150+. |
| Description | Rich text editor (Tiptap) | Same toolbar as announcement editor: heading, bold, italic, underline, lists, link, image upload, blockquote. Image upload: max 5 MB, JPEG/PNG/WebP. |
| Date/time fields | Date + time pickers | Start date, start time, end date, end time. Timezone shown. End time before start time shows inline error: "End time must be after start time." |
| Location | Radio + conditional fields | "In-person" (venue name text + address text fields) or "Online" (meeting link URL field). |
| Cover image | Upload zone | Drag-and-drop or click. Max 5 MB, JPEG/PNG/WebP. Auto-crops to 16:9 aspect ratio. |
| Registration toggle | Toggle | "Enable registration?" Off = event is informational only. On: reveals Free/Paid radio and capacity fields. |
| Free/Paid radio | Radio (visible when registration on) | Free: instant confirmation. Paid: fee amount input (currency from org locale) appears. Paid with no gateway configured shows inline error: "Connect your payment gateway first in Org Settings." with link. |
| Capacity limit toggle | Toggle (visible when registration on) | Off = unlimited. On: max registrants number input appears. |
| QR check-in toggle | Toggle | "Enable QR check-in?" Manual check-in is always available regardless of this setting. |
| Visibility selector | Radio | Internal (default, org-only) / Network-wide (shared to other orgs' feeds). If Network-wide: additional "Public page" toggle appears that generates a shareable public URL. |
| Save Draft button | Secondary button | Saves without publishing. Redirects to event detail with "Draft" status. |
| Publish button | Primary button | Publishes immediately. Triggers notifications to org members. Redirects to event detail on success. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Empty form | Page load | All fields at default/empty; placeholder text in all inputs |
| Validation error: required fields | Publish or Next clicked with missing required fields | Inline errors per field. Publish/Next blocked. Fields with errors highlighted in red. |
| Validation error: end before start | End time earlier than start time | Inline error: "End time must be after start time." |
| Paid + no gateway | Paid registration selected, no gateway | Inline warning: "Online payment is not configured. Set up your payment gateway in Org Settings to accept paid registrations." Link to gateway settings. |
| Submitting | Publish clicked (valid form) | Spinner on Publish button; form disabled |
| Success: published | Publish completes | Redirect to `/org/[id]/officer/events/[id]` with success toast: "Event published successfully." |
| Success: draft saved | Save Draft clicked | Redirect to `/org/[id]/officer/events/[id]` with toast: "Draft saved." |
| Publish failed | API error | Toast (error): "Failed to publish. Your draft has been saved. Try again." Buttons re-enabled. |
| Image upload failed | Wrong type or too large | Inline error: "Image upload failed. Max 5 MB, JPEG/PNG/WebP only." |

## Interactions

- On desktop, the live preview panel updates in real time as the officer types — title, date, location, cover image, and type badge all reflect changes immediately without any save action.
- Selecting "Paid" registration reveals the fee amount input. If no payment gateway is configured, an inline warning appears immediately below the fee field: "Online payment is not configured. Set up your payment gateway in Org Settings." The warning links to gateway settings and blocks the Publish button until the gateway is connected or the fee type is switched back to Free.
- Toggling "Enable registration" off hides the fee, capacity, and waitlist fields instantly and removes any validation errors from those fields.
- Toggling "Network-wide" visibility reveals the "Public page" toggle. Toggling it on shows a preview of the public URL that will be generated (e.g., `/events/[slug]`).
- On mobile, "Next" validates the current step's required fields before advancing. Attempting to advance with errors highlights the invalid fields inline and blocks progression. "Back" navigates to the previous step without validation.
- End time is validated on blur — if end time is before start time the inline error appears immediately and the Publish button is blocked.
- "Save Draft" saves without validation of optional fields and redirects to `/org/[id]/officer/events/[id]` with a "Draft saved" toast. The officer can return later to complete and publish.
- "Publish" validates all required fields across all sections before submitting. If any section has errors, the form scrolls to the first error. On mobile, the step containing the error is shown.
- On successful publish, the officer is redirected to `/org/[id]/officer/events/[id]` with a success toast. Navigating away mid-form (browser back or sidebar link) triggers a browser-level "Leave page?" prompt if any field has been changed.
