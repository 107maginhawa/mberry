# Communications Dashboard

- **Route:** `/org/[id]/officer/communications`
- **Module:** M07 Communications
- **Access:** Officer (any role)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives officers a central view of all org announcements — sent, scheduled, and draft — with delivery stats and quick access to compose a new announcement.

## Layout

### Desktop
Sidebar navigation visible. Main content opens with a stats summary row at the top (total announcements this month, average read rate, total recipients reached), then a filter/search toolbar, then the announcement list. "New Announcement" primary button anchors the top-right header and links to `/org/[id]/officer/communications/new`.

### Mobile
Full-width single column. Stats summary collapses into a single scrollable strip. Filter bar condenses into a status tab strip + a search icon. Announcement cards are full-width and tap-navigable to detail.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Stats summary row | Stat cards (3-up) | Total announcements this month, average read rate (%), total recipients reached. Always visible above the list. |
| Status tabs | Tab strip | All / Sent / Scheduled / Drafts. Selecting a tab immediately filters the list. |
| Date range picker | Filter control | Narrows the list to announcements created or published in the selected range. |
| Search | Text input | Searches by announcement title. 300ms debounce. |
| Announcement card | List card | Title, first 100 characters of content as preview text, publish date (or scheduled time or "Draft"), status badge (Sent=green / Scheduled=yellow / Draft=gray), audience label (All members / By category), delivery stats row (Recipients, In-app views, Email opens). Clicking the card navigates to the announcement detail view at `/org/[id]/officer/communications/[id]`. |
| New Announcement button | Primary button | Links to compose screen. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on stat cards and announcement cards (20 placeholders) |
| Empty | No announcements for this org | Illustration + "No announcements yet. Keep your members informed with announcements about upcoming events, policy changes, or general updates." + "Create First Announcement" button |
| Populated | Announcements exist | Paginated list, 20 per page |
| Filtered — no results | Tab or search yields nothing | "No announcements match your filters." with "Clear filters" link |
| Error | API load failure | "Unable to load announcements. Please try again." with retry button |
| Scheduled publish failed | Auto-publish failed after 3 retries | In-list banner on that card: "Scheduled send failed. Publish manually." with a "Publish Now" inline action |

## Interactions

- Status tabs (All / Sent / Scheduled / Drafts) filter the list immediately on click — no debounce. Switching tabs clears any active search term. The date range picker and status tab work as AND filters: selecting "Scheduled" + a date range shows only scheduled announcements within that range.
- Search by announcement title activates after the first character with a 300ms debounce. Clearing the search field restores the tab-filtered list.
- Clicking an announcement card navigates to `/org/[id]/officer/communications/[id]`. The entire card surface is clickable.
- "New Announcement" button navigates to `/org/[id]/officer/communications/new`. No dialog or confirmation.
- For cards with "Scheduled" status, hovering the scheduled time shows a tooltip with the exact publish datetime and timezone.
- For cards with "Draft" status, there is no delivery stats row — stats are replaced with a "Draft — not sent" label.
- When an auto-publish fails (after 3 retries), the affected card shows an inline error banner: "Scheduled send failed. Publish manually." The "Publish Now" inline action on that card navigates to the announcement detail page (where the content is editable and can be published manually), rather than triggering a silent re-send.
- Delivery stats (Recipients, In-app views, Email opens) on sent announcement cards are read-only on the dashboard. Clicking any stat value on a card navigates to the announcement detail page where full stats are displayed.
