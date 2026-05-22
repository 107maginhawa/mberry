# Elections List

- **Route:** `/org/[id]/officer/elections`
- **Module:** M12 Elections & Governance
- **Access:** President, Secretary
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives officers a chronological view of all elections and bylaw ratification votes for the organization, with quick status visibility and a path to create new elections.

## Layout

### Desktop
Sidebar with Elections active. Main content shows a card list sorted by date descending (most recent first). A "New Election" button is pinned in the top-right of the content area. A secondary tab strip allows switching between "Elections" and "Officer Terms" views (the officer terms timeline lives here per M12 UX spec).

### Mobile
Full-screen scrollable card list. "New Election" is a floating action button at the bottom right. The Officer Terms tab is accessible via the same tab strip below the header.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Election card | Card | Shows: election title, type badge (Officer Election / Bylaw Ratification), status badge (Draft / Nominations Open / Voting Open / Awaiting Confirmation / Published), active date range, and voter turnout (if voting has started). |
| Status badge | Colored badge | Draft (gray), Nominations Open (blue), Voting Open (green), Awaiting Confirmation (amber), Published (purple). |
| Voter turnout indicator | Text | "42 of 120 members voted (35%)." Shown once voting has started. Hidden in Draft and Nominations Open states. |
| New Election button | Primary button | Navigates to /org/[id]/officer/elections/new. |
| Officer Terms tab | Tab | Switches to the officer terms timeline view. Shows current officers with term end dates, historical terms, and upcoming vacancies highlighted in amber. |
| Export to PDF button | Secondary button | Available in the Officer Terms tab. Downloads a PDF of the full officer term history for governance records. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton election cards with shimmer. |
| Empty | No elections created yet | Empty state: "No elections yet. When your organization holds an election, it will appear here." CTA: "Create Your First Election." |
| Populated | Elections exist | Full card list. Most recent election at top. |
| Officer Terms — empty | No terms recorded | Message: "No officer terms recorded. Terms are created when elections are published." |
| Officer Terms — populated | Terms exist | Timeline grid: rows are positions, columns are time. Current terms highlighted, upcoming vacancies amber, historical terms grayed. |

## Interactions

- Tapping an election card navigates to /org/[id]/officer/elections/[id].
- The Officer Terms tab shows a timeline grid on desktop (rows = officer positions, columns = time). On mobile, it renders as a list of officer positions with term start, term end, and days remaining.
- Upcoming vacancies (term end within 30 days) appear as amber-highlighted rows in the Officer Terms view and also as smart action cards on the main dashboard.
- "Export to PDF" in Officer Terms generates a PDF containing the current officer roster, term dates, and historical roster going back to the org's founding date (as recorded in the system).
- Elections in "Published" state are immutable — no edit options are shown on the card or the detail page per M12-R1.
