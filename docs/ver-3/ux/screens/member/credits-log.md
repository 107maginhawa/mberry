# Add Manual Credit Entry

- **Route:** `/my/credits/log`
- **Module:** M10 Credit Tracking
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member self-report a CPD credit for an external activity (one not attended through the Memberry platform), which is immediately reflected in their credit total with no approval required.

## Layout

### Desktop
Single-column form, max-width 500px, centered within the authenticated shell (left sidebar visible). Page heading: "Add Manual Credit Entry." Fields stack vertically with clear grouping. A "Back to Credits" breadcrumb link appears above the heading. The "Save Entry" primary button and "Cancel" link are at the bottom of the form.

### Mobile
Full-width form. Same field order. The "Save Entry" button is sticky at the bottom of the screen so it remains accessible without scrolling. Bottom nav is visible with Credits tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Activity name input | input | Required. Text input, max 200 characters. Label: "Activity Name." Placeholder: "e.g., Annual Dental Convention 2026." |
| Provider / organizer input | input | Required. Text input, max 200 characters. Label: "Provider or Organizer." Placeholder: "e.g., Philippine Dental Association." |
| Date of activity picker | input | Required. Date picker. Must not be in the future. Label: "Date of Activity." |
| Credit value input | input | Required. Numeric input with 0.5 increments. Minimum 0.5. Label: "Credits Earned." Helper text: "Enter the number of CPD credits as stated on your certificate or program." |
| Supporting document upload | file | Optional. Accepts PDF, JPEG, PNG, or WebP. Max 5 MB per M10-R5. Label: "Supporting Document (optional)." Helper text: "Upload your certificate or proof of attendance." Shows file name after selection. "Remove" link to clear the file. |
| Org context selector | select | If the member belongs to multiple orgs with credit tracking enabled, a dropdown appears to select which org context this entry belongs to. Hidden if only one eligible org. Label: "Credit Towards." |
| "Save Entry" button | button | Primary. Submits the form. No approval workflow — entry is created immediately (M10, 10.2). |
| "Cancel" link | link | Returns to `/my/credits` without saving. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page opens | Brief skeleton for form fields; resolves in under 500ms in normal conditions. |
| Empty | Default state | All fields empty with placeholder text and helper text visible. Save button is disabled until all required fields are filled. |
| File selected | Member picks a document | File name and size displayed below the upload zone. "Remove" link appears. Upload is validated client-side for format and size before submission. |
| File too large | File exceeds 5 MB | Inline error below upload zone: "File exceeds 5 MB. Supported formats: PDF, JPEG, PNG, WebP. Max 5 MB." |
| Invalid file format | Member uploads a non-supported file | Inline error: "Supported formats: PDF, JPEG, PNG, WebP. Max 5 MB." |
| Saving | Member clicks "Save Entry" | Button shows spinner. Fields disabled. |
| Success | Entry created | Toast on redirect: "Credit entry added." Member is redirected to `/my/credits` where the new MANUAL entry appears at the top of the credit log with a "Manual" badge. The cycle progress bar updates immediately. |
| Error | Save fails (server error) | Toast: "Could not save your credit entry. Please try again." Fields remain filled. |
| Date in future | Member picks a future date | Inline error below date picker: "Activity date cannot be in the future." Save button remains disabled. |

## Interactions

- All required fields must be filled before the "Save Entry" button becomes enabled; the button is visually disabled and does not respond to taps while required fields are empty.
- Credit value field accepts keyboard numeric input or tap-to-increment/decrement arrows; minimum step is 0.5 credits.
- Document upload supports drag-and-drop on desktop and opens the file picker on mobile tap.
- Entry is audit-logged on creation per M10-R3 — the member does not see this, but the system records the event.
- MANUAL entries are editable after creation (until the cycle closes). Editing is done from the entry detail view on `/my/credits`, not from this form.
- If no orgs with credit tracking are enabled, this page is inaccessible — the "Add Credit" button on `/my/credits` is hidden and navigating directly to this route redirects to `/my/credits` with a notice.
