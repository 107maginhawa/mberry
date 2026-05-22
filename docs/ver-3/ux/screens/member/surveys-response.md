# Survey Response

- **Route:** `/my/surveys/[id]`
- **Module:** M18 Surveys & Polls
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member read and respond to a survey or poll sent by their organization's officers, with clear communication of anonymity status before any input is given.

## Layout

### Desktop
Single-column, max-width 640px, centered within the authenticated shell (left sidebar visible). An org context header at the top shows which org sent the survey, the survey title, and a deadline countdown. Anonymity notice is prominently displayed just below the header. Questions render sequentially in a single scrollable page. A sticky "Submit Response" button is fixed at the bottom of the viewport. For polls, results may appear inline after voting (if configured by the officer).

### Mobile
Full-width. Org header and anonymity notice are compact but remain visible. Questions stack in a single column. "Submit Response" button is sticky at the bottom of the screen above the bottom nav. Bottom nav is visible with Profile tab active (surveys are accessed via a notification deep link, not a persistent nav item).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org context header | header | Shows: org logo, org name, survey title (h1), deadline ("Closes [date]" or "Closes in [X] days"). |
| Anonymity notice | banner | For anonymous surveys (default, BR-40): "This survey is anonymous. Your identity will not be attached to your responses." Shown in a neutral info banner. For identified surveys: "This is an identified survey. Your name will be visible to authorized officers of [Org Name]." Shown in an amber warning banner. The notice must be visible before the first question. |
| Progress indicator | progress | "Question X of Y" with a thin progress bar at the top of the question area. |
| Multiple choice question | form | Label + radio buttons (single-select) or checkboxes (multi-select). Required indicator if question is mandatory. |
| Rating scale question | form | Label + a numeric scale rendered as clickable buttons or a slider (e.g., 1–5 or 1–10). Optional labels at each end (e.g., "Poor" and "Excellent"). |
| Free text question | form | Label + a textarea with a configurable max character length. Character counter shown below the textarea (e.g., "120 / 500"). |
| Ranking question | form | Label + a drag-to-reorder list of items. On mobile, up/down arrow buttons replace drag for accessibility. |
| "Submit Response" button | button | Primary. Sticky at the bottom. Disabled until all required questions are answered. On click, shows a confirmation dialog: "Submit your response? You will not be able to change it after submitting." (unless the survey allows editing before deadline). |
| Poll results section | section | For polls only, appears after voting (if officer configured "show results immediately"). Shows real-time results as a horizontal bar chart per option with percentage and vote count. |
| "Edit Response" link | link | Visible after submission if the survey allows editing before the deadline. Navigates back to the form with existing answers pre-filled. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for question blocks with shimmer. Header and anonymity notice load first (highest priority). |
| Active — not yet responded | Member opens the survey before the deadline | Full form renders with all questions empty. Submit button disabled until required questions are answered. |
| Already responded — editable | Member has submitted and editing is allowed | Form pre-fills with the member's previous answers. Submit button relabeled "Update Response." Notice: "You have already responded. Update your answers before [deadline]." |
| Already responded — non-editable | Member has submitted and editing is not allowed | Read-only view of submitted answers. Notice: "You have already submitted your response. Thank you." No form interaction. |
| Survey closed — past deadline | Member opens a survey after its deadline | Full-page notice: "This survey is closed. The deadline was [date]." No form rendered. For polls with results visible: poll results chart is shown below the notice. |
| Survey not found | Invalid or inaccessible survey ID | Full-page error: "This survey is not available. It may have been closed or removed." |
| Poll — results visible after voting | Poll configured to show results immediately | After submitting, the form replaces with an animated bar chart showing live results per option. Real-time vote counts visible. |
| Submission in progress | Member taps "Submit Response" | Confirmation dialog opens. On confirm, button shows spinner. |
| Submission success | Response saved | Toast: "Response submitted. Thank you." For polls: transitions to the results view (if configured). For surveys: member sees a "Thank you" message or is redirected to their dashboard. |
| Network error during submission | Connection lost on submit | Toast: "Could not submit your response. Check your connection and try again." Form data is preserved (not cleared). |

## Interactions

- The anonymity notice is non-dismissible and always visible when the form is scrolled to the top. It is not behind a toggle or accordion — it renders inline in the page flow.
- Required questions are marked with a red asterisk (*). The "Submit Response" button remains disabled until all required questions have at least one selection or non-empty text.
- Ranking questions on desktop support drag-and-drop reordering with a drag handle icon on each item. On mobile, up/down arrow buttons are the primary affordance, but drag is supported if the device handles it.
- Free text questions enforce the character limit client-side: input stops accepting new characters at the max; the character counter turns red as the member approaches the limit.
- For polls, the response is final if "show results immediately" is on — there is no editing after the poll result view is shown.
- Surveys reach the member via a notification deep link (in-app notification or email). The route `/my/surveys/[id]` resolves to the correct survey using the survey ID in the URL. Invalid or expired IDs return the "not available" state.
- One response per member per survey is enforced by the system (M18, Response Management). The platform does not expose whether a survey is anonymous or identified to the officer at the individual response level — only aggregate stats are shown to officers (BR-40).
