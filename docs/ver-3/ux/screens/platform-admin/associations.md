# Association List

- **Route:** `/admin/associations`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (all roles)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Provide Memberry operators with a searchable, filterable list of all top-level association tenants and a starting point to drill into any association's details or create a new one.

## Layout

Full-width data table page. A top bar contains the search input on the left, filter controls in the center, and a primary "Create Association" button on the right. Below the top bar is a sortable, paginated data table (20 rows per page) where each row is a single association. Clicking any row navigates to that association's detail page. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search bar | Text input | Searches by association name; debounced 300ms; clears with an × button. |
| Country filter | Dropdown | Multi-select list of configured countries; filters table to matching associations. |
| Status filter | Dropdown | Options: All, Active, Suspended, Cancelled. |
| Date range filter | Date picker | Filters by association creation date range. |
| Data table | Sortable table | Columns: Name, Country (flag + name), Org Count, Member Count, Status (badge), MRR (currency), Created Date. All column headers are clickable to sort ascending/descending. |
| Status badge | Inline badge | Green = Active, amber = Trial/Pending, red = Suspended/Cancelled. |
| Pagination | Footer control | 20 rows per page; next/previous and page number controls. |
| "Create Association" button | Primary CTA | Opens `/admin/associations/new` (modal or dedicated page). |
| URL filter params | State | `?status=pending` and `?billing=failed` and `?trial=expiring` pre-apply the relevant filter when navigated from the dashboard actionable cards. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton with placeholder rows matching the expected count. |
| Empty | No associations exist | Centered message: "No associations created yet. Start by creating your first association." with the "Create Association" button repeated inline. |
| Filtered, no results | Active filter returns zero rows | "No associations match your filters. Try adjusting your search or filters." with a "Clear filters" link. |
| Error | Data fetch fails | "Could not load associations. Retry." with a retry button. |

## Interactions

- Row click navigates to `/admin/associations/[id]`.
- Column headers sort the table; clicking the same header again reverses sort direction. Sort direction indicated by an up/down chevron.
- Bulk actions are not supported; associations are managed individually.
- "Create Association" opens the new-association form.
- URL query parameters (`?status`, `?billing`, `?trial`) are applied as pre-set filters when arriving from the dashboard cards; the active filter is visually reflected in the filter controls.
