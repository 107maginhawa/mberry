# Create Survey

- **Route:** `/org/[id]/officer/surveys/new`
- **Module:** M18 Surveys & Polls
- **Access:** President, Officers
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows officers to create a new survey or poll — configuring the question set, anonymity setting, distribution target, response deadline, and reminder schedule before publishing to members.

## Layout

### Desktop
Sidebar with Surveys active. Main content is a single-column form with a live preview panel on the right (30% width). The preview updates as questions are added. A step-like logical grouping organizes the form: Settings (type, anonymity), Questions, Distribution, Schedule.

### Mobile
Single-column form. No live preview. Sections are collapsible accordions that expand as the officer progresses. Sticky footer with "Publish" and "Save Draft" buttons.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Form type selector | Radio group | Survey / Poll. Selecting Poll limits the question section to exactly one multiple-choice question. |
| Anonymity toggle | Toggle with explanation | Anonymous (default, on) / Identified (off). When toggled to Identified, a visible warning appears: "Members will be informed that their identity is attached to their response before they answer." |
| Survey title | Text input | Required. Max 200 characters. |
| Description / instructions | Textarea | Optional. Shown to members above the question list. |
| Question builder | Dynamic question list | Each question has: Question type selector (Multiple Choice / Rating Scale / Free Text / Ranking), Question text (required), and type-specific options (see below). Minimum 1 question. |
| Question type — Multiple Choice options | Dynamic option list | Add/remove options. Minimum 2 options. "Allow multiple selections" toggle. |
| Question type — Rating Scale options | Two number inputs | Min value and max value. Optional labels for min and max (e.g., "Not satisfied" / "Very satisfied"). |
| Question type — Free Text options | Max length input | Optional. Default unconstrained. |
| Question type — Ranking options | Dynamic ordered list | Officer defines the items to be ranked. Minimum 2 items. |
| Add Question button | Secondary button | Appends a new question to the builder. |
| Reorder handle | Drag handle per question | Questions can be reordered via drag. |
| Distribution selector | Radio group | All org members / Active members only / Specific categories (multi-select category list). |
| Response deadline | Date-time picker | Optional. If set, survey closes at this date and time. If left empty, survey remains open until officer manually closes it. |
| Reminder schedule | Multi-select checkboxes | Options: 3 days before deadline, 1 day before deadline, custom date. Available only if response deadline is set. Reminders sent via M07 to members who have not yet responded. |
| Publish button | Primary button | Publishes immediately. Members in the distribution target receive a notification via M07 with a link to respond. |
| Save as Draft button | Secondary button | Saves without notifying members. Draft accessible from /org/[id]/officer/surveys. |
| Cancel link | Text link | Returns to /org/[id]/officer/surveys. Confirmation dialog if unsaved changes exist. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Empty form | Page load | Form fields blank. Type defaults to Survey. Anonymity defaults to Anonymous (on). Distribution defaults to Active members only. |
| Poll selected | Officer selects "Poll" as form type | Question section collapses to show exactly one question slot, limited to Multiple Choice type only. All other question types are hidden. Reminder and deadline sections remain. A note appears: "Polls support real-time results visibility — configure whether members see results before or after the poll closes." |
| Identified survey warning | Anonymity toggled to Identified | Warning banner: "This survey is identified. Members will be informed that their name is attached to their response before they answer. BR-40 applies: platform admin cannot access individual response-to-member mappings." |
| Validation error | Publish/Save with missing required fields | Inline errors per field. Cannot submit. Errors: "Survey title is required," "At least one question is required," "Multiple choice questions require at least 2 options," etc. |
| Publishing | Publish button clicked | Button shows spinner. Inputs disabled. |
| Published | Survey published successfully | Navigate to /org/[id]/officer/surveys/[id]. Toast: "Survey published. Members have been notified." |
| Draft saved | Save Draft clicked | Navigate to /org/[id]/officer/surveys. Toast: "Survey saved as draft." |
| Error | Server error | Toast: "Failed to publish survey. Please try again." User stays on form. |

## Interactions

- Questions can be reordered at any time during creation via drag handles. The order in the builder matches the order members see.
- For Poll type: a "Show results" radio appears: "Show results immediately after voting" or "Show results after poll closes." This configures whether members see the real-time tally after submitting their own response.
- Distribution "Specific categories" reveals a multi-select list of the org's membership categories (from M05). Only members matching the selected categories receive the survey notification and can respond.
- If reminder schedule is configured but no deadline is set, the reminder options are hidden and a note reads: "Set a response deadline to configure automatic reminders."
- The live preview (desktop) shows the survey or poll as it will appear to members on /my/surveys/[id], updating in real time. It shows the title, description, and each question as a member would see it — but is non-interactive.
- Surveys with identified responses: the officer sees an additional confirmation dialog on Publish: "Publish this identified survey? Members will be told their response is linked to their identity. This cannot be changed to anonymous after publishing." Confirm / Cancel.
