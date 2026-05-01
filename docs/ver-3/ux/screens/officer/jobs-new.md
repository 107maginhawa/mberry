# Create Job Posting

- **Route:** `/org/[id]/officer/jobs/new`
- **Module:** M15 Job Board
- **Access:** President, Secretary
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows officers to create and publish a new job listing to the association-wide job board, including all required details for applicants to evaluate and apply for the role.

## Layout

### Desktop
Sidebar with Jobs active. Main content is a single-column form with labeled sections. A live preview panel on the right (30% width) shows how the listing will appear to members as the officer fills it in.

### Mobile
Single-column form, no live preview. Sections scroll sequentially. Sticky footer with "Post Job" and "Save Draft" buttons.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Job title | Text input | Required. No explicit max length, but placeholder suggests brevity: "e.g., Associate Dentist — Full Time." |
| Organization/clinic name | Text input | Pre-filled with org name. Editable if the listing is for an affiliated clinic rather than the org itself. |
| Location — Province | Dropdown | Required. Standard Philippine province list. |
| Location — City | Text input | Required. Free text. |
| Employment type | Radio group | Full-time / Part-time / Locum/Relief / Contract. Required. |
| Specialty requirement | Multi-select dropdown | Required. Populated from platform specialty list. Multiple specialties can be selected if the role accepts candidates from more than one discipline. |
| Job description | Rich text textarea | Required. Supports bold, bulleted lists, and paragraphs. Max 3,000 characters. Character counter shown below. |
| Application instructions | Plain text textarea | Required. Prompt: "Describe how candidates should apply. Include what to send and where." |
| Contact email | Email input | Optional if application URL is provided. Validated as email format. |
| Application URL | URL input | Optional if contact email is provided. Validated to require a valid URL. |
| Expiry date | Date picker | Default: today + 30 days. Minimum: today + 7 days. Maximum: today + 30 days (per BR-37). |
| Post Job button | Primary button | Publishes immediately for verified platform orgs. Submits for admin review for external employer accounts. |
| Save as Draft button | Secondary button | Saves without publishing. Draft appears in /org/[id]/officer/jobs with "Draft" status. |
| Cancel link | Text link | Returns to /org/[id]/officer/jobs. Confirmation dialog if unsaved changes exist. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Form fields render empty. Pre-fills org name in organization field. |
| Filling | Default | Form is being filled by the officer. Live preview updates on desktop. |
| Validation error | "Post Job" clicked with missing or invalid fields | Inline error messages below each invalid field. At-least-one-of-email-or-URL validation fires if both are empty: "Provide at least one contact method (email or URL)." Form is not submitted. |
| Saving | "Post Job" clicked with valid form | Button shows spinner and "Posting..." text. Inputs disabled. |
| Success — published | Post succeeds for verified org | Navigate to /org/[id]/officer/jobs with success toast: "Your listing is live on the job board." |
| Success — pending review | Post succeeds for external employer | Navigate to /org/[id]/officer/jobs with toast: "Your listing has been submitted for review. It will appear on the job board after platform admin approval." |
| Draft saved | "Save as Draft" clicked | Toast: "Listing saved as draft." Navigate to /org/[id]/officer/jobs. |
| Error | Server error | Toast: "Failed to post listing. Please try again." User remains on the form. |

## Interactions

- At least one of contact email or application URL is required. The form shows an error message at the bottom of both fields if both are empty on submission. Either field alone is sufficient to submit.
- The expiry date picker defaults to 30 days from today and shows a helper text: "Listings expire automatically. You can extend later from the management screen."
- If an officer sets a custom expiry fewer than 7 days from today, the date picker shows an error: "Minimum listing duration is 7 days."
- The live preview (desktop only) renders the listing card and listing detail as members would see it, updating in real time as fields are typed. This helps officers catch formatting issues before posting.
- Rich text in the job description supports bold (Ctrl+B / Cmd+B), bulleted lists (markdown-style "-" at line start), and paragraph breaks. No headers, no links, no images.
- Listings from verified platform organizations are published immediately upon clicking "Post Job" — no admin review step. The listing appears on the association-wide job board within seconds.
- The "Save as Draft" path allows officers to save a partially complete listing and return to it later. Drafts are not visible to members.
