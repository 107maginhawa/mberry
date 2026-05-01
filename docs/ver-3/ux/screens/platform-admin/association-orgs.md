# Association Organizations

- **Route:** `/admin/associations/[id]/orgs`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (all roles)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Let operators view and manage all organizations within a single association, add new organizations, and monitor each org's lifecycle status and health score from one dedicated page.

## Layout

Full-width list page. A breadcrumb at the top reads "Associations > [Association Name] > Organizations." A top bar holds a search input, status and type filters, and an "Add Organization" primary button on the right. Below is a data table with one row per org. A right-side drawer slides in when an admin clicks a row, showing a condensed org summary without leaving the list. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | Links back to association detail and association list. |
| Search | Text input | Searches by org name; debounced 300ms. |
| Status filter | Dropdown | All, Trial, Active, Suspended, Cancelled. |
| Type filter | Dropdown | All, Chapter, Society, National Body, Clinic. |
| Data table | Sortable table | Columns: Org Name, Type, Region, Status (badge), Member Count, Trial Expiry (if status = Trial), Health Score (0–100 color-coded), Joined Date. |
| "Add Organization" | Primary button | Opens the new-org form for this association. See journey PA-2 for field set: org name, type, region, founding officer email, trial period start/end. |
| Row click: summary drawer | Slide-in drawer | Shows org name, type, status, member count, health score breakdown, and quick-action buttons: "View Org Detail," "Extend Trial," "Suspend," "Reinstate," "Cancel." |
| Org lifecycle action buttons | Buttons in drawer | State-machine enforced: available actions depend on current status (Trial → Active/Cancelled; Active → Suspended/Cancelled; Suspended → Active/Cancelled; Cancelled → none). Destructive actions (Suspend, Cancel) require a confirmation dialog with a reason field. |
| Health score | Color-coded number | Green 70–100, amber 40–69, red 0–39. Tooltip lists contributing factors. |
| Trial expiry | Inline label | "Expires in N days" — amber ≤ 14 days, red ≤ 3 days, overdue shown as "Expired N days ago" in red. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Empty | No orgs in this association | Centered: "No organizations in this association yet. Add the first organization." with the "Add Organization" button. |
| Filtered, no results | Filter returns zero rows | "No organizations match your filters." with "Clear filters" link. |
| Error | Fetch fails | Inline error with retry. |
| Drawer open | Row clicked | Drawer slides in from the right; table row highlighted. Clicking outside the drawer or pressing Escape closes it. |
| Action processing | Lifecycle transition submitted | Drawer action button shows spinner; table row status badge updates optimistically on success. |

## Interactions

- "Add Organization" opens a form (modal or page) with fields: org name, type (chapter/society/national body/clinic), region/location, founding officer email, trial start date, trial end date. On success, the new org appears at the top of the table with status "Trial."
- Lifecycle transitions require a confirmation dialog: "Are you sure you want to [suspend/cancel] [Org Name]? This action [description of effect]." Reason is required for Suspend and Cancel.
- "Extend Trial" opens a date picker modal with a required reason field; extension is logged in the audit trail.
- Table pagination: 20 rows per page. Sort persists during the session.
- Clicking "View Org Detail" in the drawer navigates to the org's own admin detail page.
