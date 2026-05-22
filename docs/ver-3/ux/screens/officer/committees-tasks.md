# Committee Tasks

- **Route:** `/org/[id]/officer/committees/[id]/tasks`
- **Module:** M19 Committee Management
- **Access:** President (view); Chairperson (view + create + manage); Committee members (view + update own tasks)
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Provides a task board for tracking committee action items — allowing the Chairperson to assign work to committee members, and all members to see task status and mark their own tasks complete.

## Layout

### Desktop
Sub-page within committee context (shared header, tab bar with Tasks active). Main content: view toggle between list view and kanban view. Kanban has three columns: Open, In Progress, Completed. List view has a sortable table. "Create Task" button in the top right (Chairperson only).

### Mobile
List view only (no kanban on mobile). Sorted by due date ascending (overdue first). "Create Task" is a floating action button (Chairperson only).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| View toggle | Segmented control | List / Kanban. Desktop only. |
| Kanban board | Three-column drag-and-drop | Columns: Open (red), In Progress (amber), Completed (green). Task cards are draggable by the assignee or Chairperson. |
| Task card (kanban) | Card | Title, assignee avatar + name, due date, overdue indicator (red text if past due). |
| Task table (list view) | Sortable table | Columns: Title, Assignee, Due Date, Status, Actions. |
| Overdue indicator | Red badge or red text | Shown when due date is in the past and status is not Completed. |
| Create Task button | Primary button | Chairperson only. Opens the task creation form as a modal. |
| Task creation form | Modal form | Fields: Title (required), Description (optional textarea), Assignee (required — select from committee member list), Due Date (required date picker), Status (defaults to Open). |
| Task detail view | Side panel (desktop) or full-screen (mobile) | Opens when a task card/row is clicked. Shows full description, status, assignee, due date, and an activity log of status changes. |
| Status dropdown | Dropdown per task | Open / In Progress / Completed. Available to the assignee and Chairperson. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton task cards in kanban columns or skeleton table rows. |
| Empty | No tasks created yet | Empty state: "No tasks yet. Create a task to assign work to committee members." CTA visible to Chairperson only. |
| Overdue tasks present | One or more tasks past due date, not completed | Overdue tasks shown with red "Overdue" badge. In kanban, overdue cards are listed first within their column. In list view, they sort to the top. |
| Task created | Chairperson submits creation form | Modal closes. Toast: "Task created." Task card appears in the Open column (kanban) or as a new row (list). |
| Status updated | Assignee or Chairperson changes status | In kanban, the card animates to the new column. In list view, the status cell updates. No additional confirmation for status changes. |
| Task completed | Status set to Completed | Card moves to Completed column (kanban) or row shows green Completed status. No deletion — tasks remain as a permanent record. |
| Completed committee | Parent committee status is Completed | All edit actions hidden. Task board is read-only. Completed and in-progress tasks are visible but no new tasks can be created and no status changes are allowed per BR-39. |

## Interactions

- In kanban view, dragging a task card from one column to another updates the task's status immediately. The drag action is available to the assigned committee member and to the Chairperson. The President can drag any task. Other committee members cannot drag tasks that are not assigned to them.
- Clicking a task card opens the task detail view. The detail view shows full description, creation date, assignee, due date, all status changes with timestamps and who made each change (activity log), and an edit button (Chairperson only for full edit; assignee can only update status).
- Task creation form: the assignee dropdown shows only current committee members. If the intended assignee is not yet in the committee, they must be added from the committee detail page first.
- Due dates in the past are highlighted in red in both list and kanban views. The committee dashboard card on the committees list page also shows an overdue task count.
- Completed tasks remain visible in the Completed column / filter. They are never deleted — they form part of the permanent committee record accessible to the President even after the committee is dissolved.
- No notifications are sent for task creation or status changes by default. If M07 integration is configured for task notifications, members receive a push notification when assigned a new task and when their task becomes overdue.
