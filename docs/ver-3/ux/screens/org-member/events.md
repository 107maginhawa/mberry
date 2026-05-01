# Events List (Member View)

- **Route:** `/org/[id]/events`
- **Module:** M08 Events
- **Access:** Member (must be active member of this org)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let members browse all upcoming and past events for their org (and network-shared events from other orgs) so they can find events to attend and register.

## Layout

### Desktop
Left sidebar carries the org navigation. Main content area: a filter bar across the top, then a responsive card grid below (2 columns on medium screens, up to 3 on large). A sticky filter bar stays visible on scroll. The card grid shifts to a single-column list view if the user toggles the view.

### Mobile
Filter bar collapses to a horizontal scrollable chip row (status chips) plus a "Filters" button that opens a bottom sheet for type and date range filters. Events render as a single-column card list. Pull-to-refresh at top.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status Filter Tabs | Tabs / chips | Upcoming (default) / Past. Switches the date window for the list. |
| Type Filter | Dropdown | Filter by one of the 8 platform-defined event types (General Assembly, Induction Ceremony, Fellowship/Social, Medical/Dental Mission, Board Meeting, Committee Meeting, Fundraiser, Other). "All types" is the default. |
| Date Range Filter | Date picker pair | Optional start and end date to narrow results. |
| Org Filter | Dropdown (multi-org members only) | "My Org" (default) shows events from this org only. "All My Orgs" shows events from all orgs the member belongs to, plus network-shared events. |
| Event Card | Card | Cover image thumbnail (16:9, or a type-based placeholder icon if no image). Event type badge. Title. Date and time. Location (venue name or "Online"). Registration status chip: Open (green) / Full (orange) / Closed (gray) / Cancelled (strikethrough red). Fee badge if paid ("₱500"). Registration count if enabled ("35 / 50 spots"). |
| Empty State | Illustration + text | Shown when no events match current filters. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | 6 skeleton cards with shimmer. |
| Empty — no events | Org has published no events | "No upcoming events. Your chapter will announce events here when they're scheduled." |
| Empty — filters | Filters applied with no matches | "No events match your filters. Try adjusting the type or date range." with a "Clear filters" link. |
| Populated | Events exist | Card grid with pagination (20 per page; "Load more" button at bottom). |
| Error | API failure | "Unable to load events. Pull down to retry." |

## Interactions

- Tapping an event card navigates to `/org/[id]/events/[id]`.
- Cancelled events remain in the list with "Cancelled" chip and strikethrough styling on the title. They are not hidden.
- Network-shared events from other orgs display a small org logo and name below the event title so members know the hosting org.
- Lapsed members can browse events but registration CTAs are disabled; a tooltip on disabled buttons reads: "Renew your dues to register for events."
- Past events tab shows events sorted most recent first.
