# Committees List

- **Route:** `/org/[id]/officer/committees`
- **Module:** M19 Committee Management
- **Access:** President
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives the President an overview of all active and completed committees in the organization, with the ability to create new committees and navigate into each committee's detail.

## Layout

### Desktop
Sidebar with Committees active. Main content has a filter row (status: Active / Completed / All) and a card grid. "Create Committee" button in the top right. Each card links to the committee detail page.

### Mobile
Full-screen scrollable card list. Filter tabs at the top (Active, Completed, All). "Create Committee" is a floating action button at the bottom right.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status filter | Tab strip or segmented control | Active (default) / Completed / All. "Completed" corresponds to committees with status = Completed per BR-39. |
| Committee card | Card | Shows: committee name, type badge (Standing / Ad-hoc / Special), chairperson name, member count, term end date, status badge, and quick links to Meetings and Tasks. |
| Type badge | Colored badge | Standing (blue), Ad-hoc (teal), Special (purple — restricted visibility committees). |
| Status badge | Colored badge | Active (green), Completed (gray). |
| Term end date | Date display | "Term ends [date]" for active committees. Amber text if term ends within 30 days. "Completed [date]" for completed committees. |
| Create Committee button | Primary button | Navigates to a creation modal or inline form. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton committee cards with shimmer. |
| Empty — Active | No active committees | Empty state: "No active committees. Create a committee to organize specialized work within your organization." CTA: "Create Committee." |
| Empty — Completed | No completed committees | Empty state: "No completed committees yet." |
| Populated — Active | Active committees exist | Card grid. Default sort: most recently created first. |
| Populated — Completed | Completed committees viewed | Same card layout, all cards visually dimmed. Committees are read-only; members can no longer post or schedule meetings per BR-39. |
| Committee near term end | Term end within 30 days | Card shows amber-highlighted term end date and a warning icon. |

## Interactions

- Clicking a committee card navigates to /org/[id]/officer/committees/[id].
- "Create Committee" opens an inline creation form or modal with fields: Name (required), Type (Standing / Ad-hoc / Special), Purpose/description (optional), Term start date, Term end date, Chairperson (member search/select), and initial Members (member multi-select). All required except description.
- Special type committees show a note in the creation form: "Special committees have restricted visibility. Only the President and committee members will see this committee."
- Completed committees remain accessible via the "Completed" or "All" filter. They appear read-only — chairpersons and members lose active access upon completion per BR-39.
- Term end dates within 30 days also surface as smart action cards on the org dashboard: "Committee '[Name]' term ends in X days."
- Only the President can create or dissolve committees. Chairpersons can manage their committee's members, meetings, and tasks (from the committee detail page) but cannot create new committees.
