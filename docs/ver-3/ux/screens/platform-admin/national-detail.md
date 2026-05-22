# National Dashboard — Association View

- **Route:** `/admin/national/[id]`
- **Module:** M14 National Dashboard
- **Access:** Platform Admin (all roles); National Officers (designated for this association only)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Display the full national dashboard scoped to a single, specific association — serving as both the permalink destination for Platform Admins and the direct landing page for National Officers who belong to that association.

## Layout

This screen is functionally identical to `/admin/national` but scoped to a single association. The association selector (Platform Admin only) defaults to the association identified by `[id]` in the URL. National Officers land here directly and see no selector. The layout is the same as the national home: summary cards, trend charts, and chapter comparison table. The association name appears prominently in the page header as a breadcrumb: "National Dashboard > [Association Name]." No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | "National Dashboard > [Association Name]." For Platform Admins, "National Dashboard" is a link back to `/admin/national`. For National Officers, it is non-interactive. |
| Association selector | Dropdown (Platform Admin only) | Pre-set to this association. Selecting a different association navigates to that association's URL (`/admin/national/[id]`). |
| Summary cards (6) | Stat cards | Same as `/admin/national`: Total Members, Active Members, Chapters, Dues Collection Rate, CPD Compliance Rate, Events & Training. |
| Membership trend chart | Stacked area chart | 12-month rolling membership by status. Same controls as national home. |
| Dues Collection Rate chart | Line chart | 12-month rolling dues collection rate for this association. |
| Chapter comparison table | Sortable table | Identical to national home but pre-filtered to this association's chapters. All sort, filter, and pagination behavior is the same. |
| Export button | Secondary button | Generates PDF or CSV of this association's national dashboard view. Logged in the audit trail. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards and chart placeholders. Sequential load: cards → charts → table. |
| No chapters | Association has no chapters yet | Empty state: "No chapters have been added to [Association Name] yet." |
| Access denied | Unauthorized user navigates to this URL | 403: "You do not have access to this page. If you believe this is an error, contact your platform administrator." National officers attempting to view a different association's URL receive the same 403. |
| Association not found | Invalid [id] | 404: "Association not found." |
| Mobile | Mobile viewport | Same mobile reduced-view behavior as national home. |
| Error | Fetch fails | Per-section error with retry buttons. |

## Interactions

- All interactions are identical to `/admin/national` but scoped to the specific association.
- Chapter name links navigate to `/admin/national/[id]/orgs/[id]`.
- National Officers cannot navigate to another association's data by modifying the URL — the API enforces access control at the data layer (rule BR-36). Unauthorized attempts return a 403.
- Platform Admins switching associations via the selector update the URL to the selected association's ID, maintaining a shareable, bookmarkable URL per association view.
- The PDF export includes the association name, generation timestamp, and the exporting officer's name as a watermark.
