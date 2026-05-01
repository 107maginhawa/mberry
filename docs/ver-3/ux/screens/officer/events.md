# Events Dashboard (Officer)

- **Route:** `/org/[id]/officer/events`
- **Module:** M08 Events
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the Secretary a complete view of all org events — upcoming, past, drafts, and cancelled — with search, filters, and quick actions per event.

## Layout

### Desktop
Sidebar navigation visible. Main content opens with a stats summary row (total events this month, total registrations, average attendance rate), then a filter toolbar, then the event list in card view (default) with a table-view toggle. "New Event" primary button anchors the top-right header.

### Mobile
Stats summary collapses into a horizontal scroll strip. Filter bar shows status tabs and a filter icon for the rest. Event cards are full-width. "New Event" is a sticky bottom button.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Stats summary row | Stat cards (3-up) | Total events this month, total registrations across all events, average attendance rate (%). |
| Status tabs | Tab strip | Upcoming / Past / Drafts / Cancelled. Default: Upcoming. |
| Type filter | Dropdown | All / plus the 8 platform-defined event types (General Assembly, Induction Ceremony, Fellowship/Social, Medical/Dental Mission, Board Meeting, Committee Meeting, Fundraiser, Other). |
| Date range filter | Date range picker | Narrows results to events starting within the selected range. |
| Search | Text input | Searches by event title. 300ms debounce. |
| Card/Table toggle | View toggle | Default card view; optional table view with denser rows. |
| Event card | Card | Cover image thumbnail (or type-icon placeholder), title, type badge, date/time, location, registration count ("35/50" or "Registration off"), status badge (Published=green / Draft=gray / Cancelled=red strikethrough), visibility badge (Internal / Network). Quick actions: Edit, Cancel (with confirmation dialog), View Check-in (active on event day), Duplicate. |
| New Event button | Primary button | Links to `/org/[id]/officer/events/new`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on stat cards and event cards |
| Empty | No events created | Illustration + "No events yet. Create your first event to bring your members together." + "Create Event" button |
| Filtered - no results | Filter or search yields nothing | "No events match your filters." with "Clear filters" link |
| Populated | Events exist | Paginated cards, 20 per page |
| Error | API failure | "Failed to load events. Retry." with retry button |
| Cancel confirmation | Cancel quick action clicked | Confirmation dialog: "Cancel this event? All registered members will be notified." Cancel / Confirm buttons. |
| After cancel | Event cancelled | Card status changes to Cancelled with strikethrough styling; toast: "Event cancelled. Members have been notified." |

## Interactions

- Clicking "New Event" navigates to `/org/[id]/officer/events/new`. No confirmation required.
- Status tabs (Upcoming / Past / Drafts / Cancelled) filter the list immediately on tap — no page reload. The active tab persists if the user navigates away and returns within the same session.
- Type filter dropdown and date range picker apply on selection without a separate "Apply" button. Search triggers after 300ms debounce from the last keystroke.
- Clicking an event card (anywhere outside the quick actions) navigates to `/org/[id]/officer/events/[id]`.
- "Edit" quick action navigates to the event edit form pre-populated with existing data.
- "Cancel" quick action opens a confirmation dialog: "Cancel this event? All registered members will be notified." Confirm triggers cancellation and updates the card inline (status badge → Cancelled, strikethrough styling) with a toast. Dismiss or "Cancel" in the dialog returns to the list without changes.
- "Duplicate" quick action creates a draft copy with all fields pre-filled and redirects to the create-event form. No confirmation dialog.
- "View Check-in" quick action is only interactive on the event's start date. On any other day the button is visible but disabled with the label "Check-in opens on [date]." Clicking on the event day navigates to `/org/[id]/officer/events/[id]/attendance`.
- Pagination: "Load more" or page controls appear at the bottom when more than 20 events exist in the active filter state. "Clear filters" link resets all filters and search to their defaults in one tap.
