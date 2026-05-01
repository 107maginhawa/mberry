# Create Training

- **Route:** `/org/[id]/officer/training/new`
- **Module:** M09 Training
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Lets the Secretary create and publish a credit-bearing training program — type, schedule, credit value, regulatory approval status, enrollment configuration, and network visibility.

## Layout

### Desktop
Sidebar navigation visible. Main content is a multi-section form with five labeled sections (Basic Info, Schedule, Credits & Compliance, Enrollment, Visibility) all visible on one scrolling page. A sticky side panel shows a live preview of the training card as it will appear to members. "Save Draft" and "Publish" (or "Submit for Approval") buttons anchor the form bottom.

### Mobile
Stepped form: one section per step with a progress indicator (1 of 5). Live preview accessible as a bottom sheet via a "Preview" button. "Next" / "Back" navigation between steps.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Type selector | Dropdown | 5 platform-defined types with icon + label: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training. Selecting Convention/Conference or Online Course/Webinar reveals multi-session date fields (start date, end date, schedule description textarea). Types are immutable platform-level options (M9-R1). |
| Title input | Text input | Required. Max 200 characters. Character counter shown at 150+. |
| Description | Rich text editor (Tiptap) | Heading, bold, italic, lists, link, image upload, blockquote. Image upload: max 5 MB, JPEG/PNG/WebP. |
| Schedule: single-session | Date + time pickers | Start date, start time, end time. Timezone shown. For Seminar, Workshop, Skills Training. |
| Schedule: multi-session | Date range + description | Start date, end date (end before start shows error), schedule description textarea (e.g., "Every Saturday, 9AM-12PM"). For Convention/Conference and Online Course/Webinar. |
| Location | Radio + conditional fields | "In-person" (venue name + address text fields) or "Online" (meeting link URL). |
| Cover image | Upload zone | Max 5 MB, JPEG/PNG/WebP. Crops to 16:9 aspect ratio. |
| Credit value input | Number input | Minimum 0.5, increments of 0.5. Label: "CPD Credits Awarded." Helper text: "Credits will be automatically awarded to members upon attendance confirmation." Credit value 0 shows warning: "Training with 0 credits will not contribute to members' CPD requirements. Continue?" Credit value is locked after the first attendance confirmation is recorded (M9-R2) — a lock icon and tooltip appear once locked: "Credit value cannot be changed after attendance has been confirmed for any member." |
| Regulatory approval | Dropdown + conditional field | PRC Approved / Pending Approval / Not Applicable. If PRC Approved: reference number text input appears (optional). |
| Enrollment mode | Radio group | Open (default, any member can enroll) / Approval-required (officer approves each request) / Invitation-only (officer sends invitations). Mode cannot be changed after the first enrollment (M9-R4). |
| Fee | Radio + conditional | Free / Paid. If Paid: fee amount input (currency from org locale). Paid with no gateway: inline error "Online payment is not configured. Set up your payment gateway in Org Settings." with link. |
| Capacity limit | Toggle + number input | Off = unlimited. On = max registrants number input appears. |
| Visibility | Radio | Network-wide (default, with explanation: "Training will be visible to members of all orgs in the association") / Internal only (restricted to this org's members). |
| Approval notice | Contextual notice | If the training type requires network approval (M9-R6): "This training type requires network approval before publishing. You will be notified when it is reviewed." |
| Save Draft button | Secondary button | Saves without publishing. |
| Publish / Submit for Approval button | Primary button | "Publish" if no approval required (publishes immediately). "Submit for Approval" if approval required (status -> Pending Approval). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Empty form | Page load | All fields at default/empty |
| Multi-session fields | Convention or Online Course type selected | Schedule section expands to show start date, end date, and schedule description |
| Credit value 0 warning | Credit value set to 0 | Inline warning below field; does not block submission |
| Paid + no gateway | Paid fee selected, gateway not configured | Inline warning: "Set up your payment gateway first." Link to gateway settings. Publish blocked. |
| Approval required | Applicable training type selected | Approval notice appears; Publish button label changes to "Submit for Approval" |
| Validation errors | Submit with missing required fields | Inline errors per field; submit blocked |
| Submitting | Publish / Submit clicked (valid) | Spinner on button; form disabled |
| Published | Publish completes (no approval needed) | Redirect to `/org/[id]/officer/training/[id]` with toast: "Training published. Members can now discover and enroll." |
| Submitted for approval | Submit for Approval completes | Redirect to training detail; toast: "Submitted for approval. You'll be notified when reviewed." Status shows "Pending Approval." |
| Draft saved | Save Draft clicked | Redirect to training detail with toast: "Draft saved." |
| Image upload failed | Wrong type or size exceeded | Inline error: "Image upload failed. Max 5 MB, JPEG/PNG/WebP only." |

## Interactions

- Selecting "Convention/Conference" or "Online Course/Webinar" from the type dropdown immediately reveals the multi-session schedule fields (start date, end date, schedule description textarea) and hides the single end-time field. Switching back to Seminar, Workshop, or Skills Training collapses those fields and restores the single-session time picker.
- On desktop, the live preview side panel reflects changes to title, type, credit value badge, date, and cover image in real time as the officer edits the form.
- Credit value input: entering 0 immediately shows an inline warning below the field ("Training with 0 credits will not contribute to members' CPD requirements.") — this does not block submission. Minimum accepted value is 0.5. Values can be entered in 0.5 increments via the stepper or typed directly.
- Selecting "PRC Approved" from the regulatory approval dropdown immediately reveals an optional reference number text input below it. Selecting any other option hides the reference number input.
- Selecting "Paid" fee type reveals the fee amount input. If no gateway is configured, an inline warning appears immediately: "Online payment is not configured. Set up your payment gateway in Org Settings." The warning links to gateway settings and the Publish/Submit button is blocked until the gateway is connected or the fee type is changed to Free.
- Selecting "Approval-required" or "Invitation-only" enrollment mode shows a contextual note below the selector explaining the mode's effect. Enrollment mode cannot be changed after the first enrollment — if editing an existing training that already has enrollments, the mode selector is disabled with a tooltip.
- On mobile, "Next" validates the current step's required fields before advancing. Errors are highlighted inline and block progression. "Back" does not re-validate.
- If the training type requires network approval, the primary button label changes from "Publish" to "Submit for Approval" and an approval notice appears above the button. On success, the officer is redirected to `/org/[id]/officer/training/[id]` with a "Submitted for approval" toast and the training shows "Pending Approval" status.
- Navigating away from the form mid-fill (browser back or sidebar) triggers a "Leave page?" prompt if any field has been changed.
