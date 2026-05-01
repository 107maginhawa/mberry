# Create Election

- **Route:** `/org/[id]/officer/elections/new`
- **Module:** M12 Elections & Governance
- **Access:** President, Secretary
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows the President or Secretary to configure a new officer election or bylaw ratification vote, including title, positions, timeline, and voting mode, before creating it in Draft status.

## Layout

### Desktop
Sidebar with Elections active. Main content is a multi-step form wizard with a horizontal step indicator at the top (steps: Basics, Positions, Timeline, Voting Mode, Review). A persistent sidebar summary on the right shows the entered values as the officer progresses. "Previous" and "Next" buttons are at the bottom of each step.

### Mobile
Full-screen, one step at a time. Step indicator is a progress bar at the top. Previous / Next are sticky at the bottom. The sidebar summary is replaced by a collapsible "Review so far" accordion above the step controls.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Step indicator | Horizontal stepper (desktop) / progress bar (mobile) | 5 steps: Basics, Positions, Timeline, Voting Mode, Review. Shows completed, current, and upcoming steps. |
| Step 1 — Title | Text input | Required. Max 100 characters. Placeholder: "e.g., 2026 Annual Officer Election." |
| Step 1 — Description | Textarea | Optional. Max 1,000 characters. |
| Step 1 — Type | Radio group | Officer Election / Bylaw Ratification. Selecting Bylaw skips Step 2 (Positions). |
| Step 2 — Positions list | Dynamic list | Add positions to elect. Each position: title (text input, required), number of seats (integer, default 1). Reorderable via drag handles. Minimum 1 position required. |
| Step 2 — Add Position button | Secondary button | Appends a new position row to the list. |
| Step 3 — Nomination period | Date range pickers | Start and end date. Both required. |
| Step 3 — Voting period | Date range pickers | Start and end date. Both required. Voting start must be after nomination end. Overlap validation enforced. |
| Step 4 — Voting mode | Radio group | Online Only / In-Person Only / Hybrid. |
| Step 4 — Passage threshold | Percentage input | Bylaw Ratification only. Default 50%. Options: 50% (simple majority), 66.7% (two-thirds), 75% (three-quarters), or custom percentage. |
| Step 5 — Review | Read-only summary | All entered values shown. Each section has an "Edit" link that jumps back to that step. |
| Create Election button | Primary button | Available only on Step 5. Creates the election in Draft status. Navigates to /org/[id]/officer/elections/[id] on success. |
| Cancel link | Text link | Available on all steps. Confirmation dialog on cancel: "Discard this election? All entered information will be lost." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Step in progress | Default | Current step fields are visible and active. |
| Step validation error | User clicks "Next" with missing or invalid fields | Inline errors shown below each invalid field. Cannot advance. |
| Nomination/voting overlap error | Voting start date is before or on nomination end date | Error shown on Step 3: "Voting period must start after the nomination period ends." |
| Bylaw type selected | User selects "Bylaw Ratification" in Step 1 | Step 2 (Positions) is skipped. Step indicator updates to show 4 steps. Step 4 shows the passage threshold field instead of the standard voting mode description. |
| Review step | User reaches Step 5 | All values shown read-only. "Create Election" button is enabled. |
| Creating | User clicks "Create Election" | Button shows spinner. Inputs disabled. |
| Success | Election created | Navigate to /org/[id]/officer/elections/[id]. Toast: "Election created. Review the details and open nominations when ready." |
| Error | Server error on creation | Toast: "Failed to create election. Please try again." User remains on Step 5. |

## Interactions

- Step navigation is linear (Next / Previous). Users cannot skip steps forward, but they can go back to any completed step without losing entered data.
- On Step 2, positions can be reordered via drag handles. The order determines ballot display order for members voting.
- If type is changed from Officer Election back to Bylaw Ratification after positions were added, a confirmation appears: "Switching to Bylaw Ratification will remove all positions you configured. Continue?"
- Date pickers enforce: nomination start must be today or later; voting start must be after nomination end; voting end must be after voting start.
- On Step 5, clicking an "Edit" link for a specific section navigates directly to that step without resetting subsequent steps.
- Election is created in Draft status. No members are notified at creation. The officer must explicitly open nominations from the election detail page.
- Bylaw elections are distinct from officer elections in the state machine: they skip the nomination phase and go directly from Draft to Voting Open.
