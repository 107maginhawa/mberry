# Committee Meetings List

- **Route:** `/org/[id]/officer/committees/[id]/meetings`
- **Module:** M19 Committee Management
- **Access:** President (view); Chairperson (view + schedule); Committee members (view)
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Shows all scheduled and past meetings for a specific committee, allowing the Chairperson to schedule new meetings and all committee members to see upcoming agendas and past minutes.

## Layout

### Desktop
Sub-page within the committee detail — shares the committee header and tab bar at the top. Main content: two sections — Upcoming Meetings (chronological ascending) and Past Meetings (chronological descending). "Schedule Meeting" button in the top right (Chairperson only). Each row links to the meeting detail page.

### Mobile
Single-column list with a section header divider separating Upcoming from Past. "Schedule Meeting" is a floating action button (Chairperson only).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Committee context header | Breadcrumb or sticky header | Shows committee name and links back to /org/[id]/officer/committees/[id]. Tab bar with Meetings tab active. |
| Meeting row (upcoming) | Card or table row | Date and time, location (physical address or virtual link), agenda preview (first item or item count), attendance RSVP count (if applicable). |
| Meeting row (past) | Card or table row | Date and time, location, attendance summary (e.g., "4 of 6 attended"), minutes status badge (Draft / Finalized). |
| Minutes status badge | Badge | Draft (gray) or Finalized (green). |
| Schedule Meeting button | Primary button | Chairperson only. Opens the meeting scheduling form as a modal (desktop) or full-screen (mobile). |
| Meeting scheduling form | Modal form | Fields: Date (date picker, required), Time (time picker, required), Location (text input, required — physical address or video call URL), Agenda items (dynamic list, at least 1 required). |
| Add agenda item button | Secondary button | Appends a new text input row to the agenda list in the scheduling form. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton meeting rows. |
| No upcoming meetings | No future meetings scheduled | Upcoming section shows: "No upcoming meetings. Schedule the next meeting to keep the committee on track." CTA visible to Chairperson only. |
| No past meetings | Committee is new | Past section shows: "No past meetings yet." |
| Meeting scheduled | Chairperson submits scheduling form | Toast: "Meeting scheduled." Row appears in Upcoming section. Members notified via M07 Communications with date, time, location, and agenda. |
| Scheduling form validation error | Required field missing | Inline errors. Modal stays open. |
| Completed committee | Committee status is Completed | "Schedule Meeting" button hidden. List is read-only. All past meetings visible but no new meetings can be created per BR-39. |

## Interactions

- Clicking a meeting row (upcoming or past) navigates to /org/[id]/officer/committees/[id]/meetings/[id].
- The scheduling form agenda items are a dynamic list: at least one agenda item is required. Each item is a plain-text input. Officer can add or remove items before saving.
- M07 meeting notifications are sent automatically when a meeting is scheduled. The notification includes: committee name, meeting date and time, location or video link, and agenda items.
- If a virtual meeting link is provided (URL format validated), it renders as a clickable link in the meeting detail and in the M07 notification.
- Past meetings are sorted newest first so the most recent minutes are easy to find.
- Attendance summary on past meeting rows (e.g., "4 of 6 attended") is a quick count from the attendance record on the meeting detail. Clicking the row shows the full per-member breakdown.
