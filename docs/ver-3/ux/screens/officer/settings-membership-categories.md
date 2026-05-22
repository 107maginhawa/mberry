# Membership Categories Settings

- **Route:** `/org/[id]/officer/settings/membership-categories`
- **Module:** M05 Membership
- **Access:** President
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows the President to configure the membership categories available in the organization — defining their names, dues amounts, billing cycles, and active/inactive status.

## Layout

### Desktop
Sidebar with Settings > Membership Categories active. Main content shows a table of all current categories with inline action icons. A "Add Category" button sits in the top-right of the content area. An inline form or modal appears for create and edit actions.

### Mobile
Full-screen list of category cards instead of a table. Each card has a three-dot overflow menu for Edit and Deactivate. "Add Category" is a floating action button at the bottom right.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Category table | Table | Columns: Name, Description, Dues Amount, Billing Cycle, Members Count, Status, Actions. Sorted by sort_order. |
| Add Category button | Primary button | Opens the category form in a modal (desktop) or full-screen drawer (mobile). |
| Category form | Modal form | Fields: Name (required), Description (optional), Dues Amount (currency input, required), Billing Cycle (radio: Annual / Quarterly / Custom), Sort Order (integer, optional). |
| Life member indicator | Informational badge | Categories named "Life" auto-display an "Exempt from dues" badge. Dues amount is hidden for Life categories — dues_expiry_date is set to 2099-12-31. |
| Status badge | Badge | Active (green) or Inactive (gray). |
| Deactivate button | Destructive action | Replaces Delete. Cannot delete categories with assigned members — only deactivate. Confirmation dialog required. |
| Reactivate button | Action | Restores an inactive category to active status. Immediate. |
| Members count | Read-only integer | Number of current members assigned to this category. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton rows in the table while categories are fetched. |
| Empty | No categories configured yet | Empty state message: "No membership categories configured. Add your first category to start enrolling members." CTA: "Add Category." |
| Populated | Categories exist | Full table with all categories listed. Inactive categories shown below active ones, visually dimmed. |
| Add / Edit form open | User clicks "Add Category" or "Edit" icon | Modal opens with the category form. Existing values pre-filled on edit. |
| Saving form | User submits form | Submit button shows spinner. Inputs disabled. |
| Save success | Create or edit succeeds | Modal closes. Toast: "Category saved." Table updates immediately. |
| Validation error | Required field missing or dues amount invalid | Inline errors below each invalid field. Modal stays open. |
| Deactivate blocked | User attempts to delete a category | "Delete" is not available. Only "Deactivate" is shown, and only for categories with 0 assigned members would immediate removal apply. For categories with members, deactivate is the only option. |
| Deactivate confirmation | User clicks "Deactivate" | Confirmation dialog: "Deactivate [Name]? Members assigned to this category will keep their current category but no new members can be assigned to it." Confirm / Cancel. |
| Deactivated | Confirmation confirmed | Category status changes to Inactive. Toast: "Category deactivated." Still visible in table in a dimmed state. |

## Interactions

- The default categories seeded at org creation are: Regular, Associate, Life, Student, Honorary. Presidents can rename, edit dues, or deactivate any of these.
- Dues amount for the "Life" membership category: the field is present but automatically set to $0 and the dues_expiry_date sentinel (2099-12-31) is applied. A tooltip explains: "Life members are exempt from dues. No renewal reminders will be sent."
- Changing a category's dues amount does NOT retroactively change existing members' invoices or renewal dates — it only affects new invoices generated after the change.
- Sort order controls the display order in all member-facing dropdowns and officer forms. Drag-to-reorder is supported on desktop via row drag handles.
- Billing cycle options: Annual (dues due once per year), Quarterly (dues due every 3 months), Custom (requires specifying the interval in months, 1–24).
- Only the President can access this settings page. Other officer roles receive a 403 if they navigate directly to the URL.
