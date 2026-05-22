# Committee Meeting Detail

- **Route:** `/org/[id]/officer/committees/[id]/meetings/[id]`
- **Module:** M19 Committee Management
- **Access:** President (view); Chairperson (view + edit attendance + edit minutes); Committee members (view)
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Provides the full record for a single committee meeting — agenda, attendance tracking, and meeting minutes — giving the Chairperson tools to capture what happened and making the record available to all committee members and the President.

## Layout

### Desktop
Sub-page within committee context (shared header, tab bar with Meetings active). Three-section single-column layout: Meeting Info (date, time, location), Attendance (member list with present/absent/excused), Minutes (rich text with draft/finalize controls).

### Mobile
Single-column scroll. Sections are collapsible accordions to manage vertical space. Attendance and Minutes sections each have "Edit" buttons that expand inline edit views.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Meeting info block | Info block | Date, time, location (with clickable link if URL), agenda items as a numbered list. Edit icon for Chairperson (allows editing date, time, location, and agenda before the meeting). |
| Attendance section | Section with member rows | Per committee member: name, attendance status (Present / Absent / Excused). Status is a radio group per row, editable by Chairperson. |
| Attendance summary | Text | "X of Y attended (Z excused)." Updates as Chairperson marks attendance. |
| Save Attendance button | Primary button | Saves all attendance changes in one action. Available after any attendance status is changed. |
| Minutes editor | Rich text editor | Supports headings, bold, bullet lists, numbered lists, and paragraphs. Full page-width. Available to Chairperson to draft during or after the meeting. |
| Save Minutes (Draft) button | Secondary button | Saves the current minutes text without finalizing. Other committee members cannot see draft minutes. |
| Finalize Minutes button | Primary button | Marks the minutes as final. All committee members can now view them. Confirmation required: "Finalize minutes? They will be visible to all committee members. You can still edit them after finalization." |
| Minutes status badge | Badge | Draft (gray) or Finalized (green). |
| Edit info button | Icon button | Chairperson only. Opens the meeting info fields for editing (date, time, location, agenda). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for info block, attendance section, minutes section. |
| Upcoming meeting | Meeting date is in the future | Attendance section shows member list but all statuses default to "—" (not yet taken). Chairperson can pre-fill attendance as members confirm RSVPs, but the formal record is typically captured at/after the meeting. Minutes editor is empty. |
| Meeting complete (minutes draft) | Meeting date passed, minutes not finalized | Info block and attendance shown. Minutes section shows the draft editor with "Save Draft" and "Finalize" buttons. Members see "Minutes are being drafted." |
| Meeting complete (minutes finalized) | Chairperson finalized minutes | Minutes display as read-only formatted text. Finalized badge shown. Edit remains available to Chairperson (changes take effect immediately, no re-finalization required). |
| Attendance saved | Chairperson saves attendance | Toast: "Attendance saved." Attendance summary updates. |
| Minutes saved (draft) | Chairperson saves draft | Toast: "Minutes saved as draft." Not visible to members yet. |
| Minutes finalized | Chairperson finalizes | Toast: "Minutes finalized. All committee members can now view them." Status badge updates to Finalized (green). |
| Completed committee | Parent committee status is Completed | All edit actions hidden. Attendance and minutes are read-only. |

## Interactions

- The attendance section shows all current committee members. If a member was added to the committee after the meeting, they appear in the attendance list with a note: "Added after this meeting." Their attendance status is locked at "—" (not applicable).
- Chairperson can toggle attendance for all members individually. "Present," "Absent," or "Excused" per member. No bulk mark-all option to ensure deliberate per-member recording.
- Minutes editor is a rich text editor that autosaves to draft every 60 seconds. The autosave indicator shows: "Last saved [time]." If the user closes the tab with unsaved changes, a browser confirmation dialog appears.
- Once finalized, minutes are visible to all committee members, the Chairperson, and the President. They are not visible to org members outside the committee.
- Editing meeting info (date, time, agenda) after the meeting has passed is allowed with a visible warning: "You are editing a past meeting. Changes will update the historical record." Changes are audit-logged.
- If the meeting location is a URL (video call link), it renders as a button labeled "Join Meeting" (blue link button). If it is a physical address, it renders as plain text.
