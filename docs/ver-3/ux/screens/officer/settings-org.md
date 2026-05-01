# Org Settings

- **Route:** `/org/[id]/officer/settings/org`
- **Module:** M04 Organization Admin
- **Access:** President, all Officers
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows officers to view and edit the organization's public-facing profile — name, logo, description, contact information, address, and operational details.

## Layout

### Desktop
Sidebar navigation with the Officer section active, highlighting Settings > Org. Main content is a single-column settings form divided into labeled sections (Identity, Contact, Location, Operations). A persistent header bar shows "Org Settings" with an Edit button (view mode) or Save / Cancel buttons (edit mode).

### Mobile
Full-screen scrollable form. Edit/Save/Cancel controls are sticky at the bottom of the viewport. Logo upload and crop uses a bottom-sheet component. Section dividers use horizontal rules with section labels.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Logo uploader | File input + crop modal | Accepts SVG (sanitized per M4-R5), JPEG, PNG, WebP. Max 5 MB. Shows circular preview. Opens a crop/zoom modal on selection. |
| Org name field | Text input | Required. 2–100 characters. Displays current value in view mode. |
| Org type display | Read-only badge | Set at org creation. Not editable. Values: Chapter, Society, National Body, Clinic. |
| Description textarea | Textarea | Optional. Max 2,000 characters. Character counter shown below. |
| Contact email | Email input | Optional. Standard email validation. |
| Contact phone | Phone input | Optional. Accepts E.164 or local Philippine format. |
| Address block | Structured fields | Street, City, Province, Country, Postal Code. Each is a separate text input. All optional. |
| Website URL | URL input | Optional. Validated to require https:// protocol. |
| Meeting schedule | Text input | Optional. Free text. Placeholder: "e.g., Every 2nd Tuesday, 7PM." |
| Founding date | Date picker | Optional. Must not be in the future. |
| Edit / Save / Cancel | Action buttons | Edit transitions form to editable state. Save submits. Cancel reverts all changes. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton form fields with shimmer animation while org data is fetched. |
| View | Initial load / after Save | All fields displayed as read-only text. "Edit" button is shown in the header. |
| Edit | User clicks "Edit" | All fields become interactive inputs. "Save" and "Cancel" replace the "Edit" button. |
| Saving | User clicks "Save" | Save button shows a spinner. All inputs are disabled. Network request fires. |
| Saved | Save succeeds | Success toast: "Profile updated." Form returns to view state immediately. Public org page reflects changes. |
| Validation error | Save attempted with invalid data | Inline error messages appear below each invalid field. Form is not submitted. |
| SVG rejected | Upload of SVG with unsafe content | Error below the logo uploader: "This SVG file contains unsafe content and cannot be uploaded. Please use a different file." |
| Error | Save request fails (network or server) | Error toast: "Failed to save. Please try again." Form remains in edit state. |

## Interactions

- Clicking "Edit" transitions the entire form simultaneously — no field-level edit toggles.
- Clicking "Cancel" reverts all fields to their pre-edit values. If no changes were made, Cancel has no confirmation dialog. If changes were made, a discard-changes confirmation dialog appears: "Discard unsaved changes?"
- Logo crop modal: after selecting an image file, the crop modal opens. User can zoom and reposition. "Confirm" closes the modal and shows the cropped preview. If the user closes the modal without confirming, the previous logo is retained.
- SVGs uploaded are sanitized server-side per M4-R5 before storage. If the SVG fails sanitization, the upload is rejected with an error state.
- Founding date picker prevents selection of future dates by disabling them.
- Org type is always shown but never editable — a tooltip explains: "Org type is set at creation and cannot be changed."
- All changes take effect immediately on save and are reflected on the public org page (`/org/[slug]`) without a cache delay.
