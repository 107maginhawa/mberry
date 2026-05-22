# Member List

- **Route:** `/admin/members`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Support)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a searchable, cross-association member directory for support purposes — finding a specific member to impersonate, review, or merge duplicate accounts.

## Layout

Full-width search-and-table page. The page leads with a prominent search bar (name, email, or license number). Below the search bar are filter controls (association, org, status, role). Results render in a data table. No left sidebar. This page is the entry point to member-level support and impersonation workflows.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search bar | Text input | Searches by name, email, or license number simultaneously; debounced 300ms; auto-suggests after 2 characters. |
| Association filter | Dropdown | Narrows to members of a specific association. |
| Org filter | Dropdown | Narrows to members of a specific org (cascades from association filter). |
| Status filter | Dropdown | All, Active, Grace, Lapsed, Suspended, Pending. |
| Role filter | Dropdown | All, Member, Officer (any officer role), Admin. |
| Data table | Sortable table | Columns: Name, Email, License Number, Association, Org(s), Status (badge), Role, Last Login. |
| Status badge | Inline badge | Color-coded per membership status. |
| "View As" button | Inline action | Per row. Initiates impersonation for this member. Opens the impersonation confirmation dialog before proceeding. |
| "View Profile" button | Inline action | Per row. Navigates to `/admin/members/[id]`. |
| Duplicate flag | Inline badge | "Possible duplicate" badge in amber if the platform has detected a potential duplicate (same license number on two accounts). |
| Pagination | Footer | 25 rows per page. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Search or filter applied | Spinner in the table area; existing results remain visible while new results load. |
| Default (no search) | Page first load | Prompt text inside the table area: "Search for a member by name, email, or license number." Table is empty until a search or filter is applied. |
| No results | Search returns empty | "No members found matching '[query]'. Check spelling or try a different identifier." |
| Error | Fetch fails | "Could not load members. Retry." with retry button. |

## Interactions

- "View As" (impersonate): clicking opens the confirmation dialog: "You will see the platform exactly as [member name] sees it. All navigation will be logged. This session will auto-terminate after 30 minutes. No changes can be made." Confirming redirects to the member's dashboard with the orange impersonation banner active.
- Attempting to impersonate a platform admin: blocked. Dialog: "Cannot impersonate other platform administrators."
- "View Profile" navigates to the member detail page.
- Duplicate flag: clicking it opens the member merge tool pre-populated with both flagged accounts.
- Column sort: all columns sortable; sort by Last Login descending is useful for finding inactive members.
