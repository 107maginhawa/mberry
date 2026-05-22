# Officer Management

- **Route:** `/org/[id]/officer/officers`
- **Module:** M04 Organization Admin
- **Access:** President
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows the President to view the current officer roster, assign or remove officer roles, and manage officer transitions with a structured handover checklist.

## Layout

### Desktop
Sidebar with Officers active. Main content has two sections separated by a tab or divider: "Current Officers" and "Transition History." The Current Officers section shows a table of assigned roles. A banner appears at the top when a transition is in progress. "Assign Role" button is in the top right.

### Mobile
Scrollable list of officer role cards. Each card shows the officer's name, role, and date assigned, with an Edit/Remove menu. Transition in-progress banner is shown as a full-width amber strip above the list. "Assign Role" is a floating action button.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Officer roster table | Table | Columns: Role, Name, Assigned Date, Actions (Remove button). Rows: one per active officer role. Board Member role may have multiple rows. |
| Assign Role button | Primary button | Opens the assign role modal. |
| Assign role modal | Modal | Step 1: Search and select a member by name. Step 2: Select role from dropdown (President, VP, Secretary, Treasurer, Auditor, PRO, Board Member, Custom). Step 3: If role already taken, warning: "This role is currently held by [Name]. Assigning will remove their role." Confirm button. |
| Remove role button | Destructive button | Per row. Confirmation dialog required. |
| Transition in-progress banner | Amber status banner | Shown when an OfficerTransition record is active: "Officer transition in progress. [X] of [Y] checklist items complete." Link: "Resume Checklist." |
| Transition checklist | Stepper interface | Three steps: Generate Checklist, Complete Items, Transfer Role. Shown inline below the banner or on a dedicated sub-view. |
| Checklist item row | Row with checkbox | Each item has a label, optional notes field, and a "Mark Complete" button. Items cannot be un-completed once marked. |
| Progress bar | Linear progress indicator | Shows percentage of checklist items completed. |
| Transfer Role button | Primary button | Enabled only when checklist is 100% complete or an override reason is provided. Opens a final confirmation dialog. |
| Override option | Conditional form element | If checklist is incomplete, President may provide an override reason to proceed. Reason field is required. |
| Transition History tab | Secondary tab | Read-only log of all past role transitions with: role, outgoing officer, incoming officer, date, completion status, override reason if any. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton rows for the officer table. |
| No officers | New org with no assignments | Message: "No officers assigned yet. Assign your first officer." (President role is always the logged-in user.) CTA: "Assign Role." |
| Full roster | All standard roles filled | Table shows all roles. Custom roles option available. |
| Transition in progress | Active OfficerTransition record exists | Amber banner shown. Checklist embedded or linked. |
| Checklist not started | Transition created, no items completed | Progress bar at 0%. All items show "Not started." |
| Checklist in progress | Some items marked complete | Progress bar partially filled. Completed items show a green checkmark and the officer's name. |
| Ready to transfer | All items complete | Transfer Role button becomes enabled. |
| Override mode | President attempts transfer with incomplete checklist | Override reason field appears. Transfer button remains disabled until reason is non-empty. |
| Transfer confirmed | President confirms transfer | Role updated. New officer receives admin access. Previous officer loses admin access. Audit log entry created. Success toast: "[Role] transferred to [Name]." Transition record marked complete. |
| Role conflict warning | Assigning a role already held by someone | Warning in modal: "This role is currently held by [Name]. Assigning [New Name] will remove [Name] from this role." Requires explicit confirmation. |

## Interactions

- The one-per-role constraint (M4-R1) is enforced at the UI layer: if a role is occupied, the modal shows the conflict warning before allowing reassignment.
- Board Member is the only role that allows multiple occupants. The assign role modal for Board Member does not show a conflict warning if one already exists.
- Transferring the President role is a special case: a confirmation dialog states "This will transfer the President role to [Name]. You will become a regular member. This action is logged." A 24-hour reversal window is surfaced in the dialog ("The new President can reverse this within 24 hours").
- Custom roles: if "Custom" is selected in the role dropdown, a text field appears for the custom role name (required, max 50 characters).
- Removing an officer role requires a confirmation dialog: "Remove [Name] from the [Role] role? They will remain a regular member." Confirm / Cancel.
- Transition checklist items are auto-generated based on current org state when the transition is initiated. For President transitions, items include: pending membership applications count, outstanding payments, upcoming events within 30 days, open disciplinary cases. Items are read-only labels — the officer marks each complete with optional notes.
- Checklist items cannot be un-completed. If the President made a mistake, the override path is the only recourse.
- All role changes are written to the immutable AuditLogEntry table (M4-R6) with actor, timestamp, before/after state, and IP address.
