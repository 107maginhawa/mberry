# Module 19: Committee Management

- **Phase:** 3
- **Monetization:** Add-on
- **Dependencies:** M05 (Membership), M07 (Communications)

---

## Overview

Committee Management enables association presidents to create and manage committees within their organization. Committees handle specialized work -- standing governance functions, ad-hoc projects, or special investigations. Each committee has a chairperson, members, meetings, tasks, and reporting to the president.

---

## Key Specifications

### Committee Creation

- The association President creates committees and defines their purpose.
- President assigns a chairperson from the org roster (must be an active member).
- President assigns members from the org roster (must be active members).
- Chairperson can add or remove committee members after creation (subject to President approval if configured).

### Committee Types

| Type | Description |
|------|-------------|
| Standing | Permanent committees with ongoing mandates (e.g., Ethics Committee, Membership Committee). Persist across terms unless dissolved by the President. |
| Ad-hoc | Temporary committees created for a specific purpose. Automatically dissolved when their term expires or the President closes them. |
| Special | Committees formed for investigations or special projects. Similar to ad-hoc but may have restricted visibility (only President and committee members can see details). |

### Terms

- Each committee has a configurable term duration (start date and end date).
- Standing committees can have their terms renewed by the President.
- Ad-hoc and special committees expire at the end of their term.
- When a term expires, the committee status changes to Completed. Historical data is retained.

### Meetings

- Chairperson or designated secretary schedules meetings.
- Each meeting includes: date/time, location (physical or virtual link), agenda items.
- Attendance is recorded for each meeting (present, absent, excused).
- Minutes are captured per meeting. Minutes can be drafted during the meeting and finalized afterward.
- Meeting notifications sent via M07 Communications.

### Tasks

- Committee-level task management for tracking action items.
- Tasks are created by the chairperson or any committee member (configurable).
- Each task has: title, description, assignee (from committee members), due date, status (open, in progress, completed).
- Task status updates are visible to all committee members.
- Overdue tasks are flagged in the committee dashboard.

### Reports

- Committees deliver reports to the President.
- Reports can be submitted at any time or on a schedule configured by the President.
- Report format: free text with optional file attachments (PDF, images).
- The President reviews reports. Reports are visible to the President and to officers with appropriate permissions.
- Report status: draft, submitted, reviewed.

---

## Business Rules

| Rule | Description |
|------|-------------|
| BR-39 | Committee dissolution. When a committee's term expires or the President closes it, the committee status changes to Completed. All historical data (meetings, minutes, tasks, reports) is retained and remains readable by the President and platform admin. Committee members lose active access -- they can no longer post, schedule meetings, or create tasks. The committee does not appear in the active committee list but is accessible via a "Past Committees" filter. |

---

## Screens

| Route | Description |
|-------|-------------|
| `/org/[id]/officer/committees` | Committee list for the association. Shows all committees with type, chairperson, status (active, completed), and member count. President can create new committees. |
| `/org/[id]/officer/committees/[id]` | Committee detail page. Overview of purpose, members, chairperson, term dates, and status. Links to meetings, tasks, and reports. Chairperson and President can edit. |
| `/org/[id]/officer/committees/[id]/meetings` | Meeting list for the committee. Upcoming and past meetings with date, agenda preview, and attendance summary. Chairperson can schedule new meetings. |
| `/org/[id]/officer/committees/[id]/meetings/[id]` | Meeting detail page. Full agenda, attendance record, and minutes. Edit minutes, record attendance. |
| `/org/[id]/officer/committees/[id]/tasks` | Task board for the committee. List or kanban view of tasks with status, assignee, and due date. Create, edit, and complete tasks. |
