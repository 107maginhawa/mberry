# Organization List

- **Route:** `/admin/orgs`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (all roles)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a cross-association view of every organization on the platform, enabling search, filtering by status or health, and direct navigation to any org's detail page.

## Layout

Full-width data table page. Top bar: search input on the left, filter controls in the center (association, status, type, health tier), and no primary CTA (orgs are created through their parent association). Sortable table fills the main content area with 25 rows per page. Clicking any row navigates to that org's detail page. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search | Text input | Searches by org name; debounced 300ms. |
| Association filter | Dropdown | Multi-select list of all associations. |
| Status filter | Dropdown | All, Trial, Active, Suspended, Cancelled. |
| Type filter | Dropdown | All, Chapter, Society, National Body, Clinic. |
| Health filter | Dropdown | All, Healthy (70–100), At Risk (40–69), Critical (0–39). |
| Data table | Sortable table | Columns: Org Name, Association, Type, Region, Status (badge), Member Count, Health Score (color-coded), Trial Expiry (if applicable), Created Date. |
| Health score | Color-coded number | Green 70–100, amber 40–69, red 0–39. |
| Status badge | Inline badge | Color-coded per status. |
| Trial expiry | Inline label | Shows days remaining if status = Trial; red if ≤ 3 days. |
| Pagination | Footer | 25 rows per page; page controls. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Empty | No orgs exist on platform | "No organizations yet. Create organizations within an association." with link to `/admin/associations`. |
| Filtered, no results | Active filter returns zero | "No organizations match your filters." with "Clear filters" link. |
| Error | Fetch fails | "Could not load organizations. Retry." with retry button. |

## Interactions

- Row click navigates to `/admin/orgs/[id]`.
- Column headers sort ascending/descending; sort direction shown with chevron.
- Filters are additive (AND logic); multiple active filters narrow results.
- Health score column is sortable; default sort is by health score ascending (most at-risk first) when the health filter is applied; otherwise default sort is by org name.
- No bulk actions — orgs are managed individually from their detail page.
