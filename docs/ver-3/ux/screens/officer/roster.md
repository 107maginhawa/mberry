# Member Roster

- **Route:** `/org/[id]/officer/roster`
- **Module:** M05 Membership
- **Access:** Officer (any role)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Gives officers a complete, searchable, filterable view of all org members with their status, category, and dues information, and enables bulk actions across selected members.

## Layout

### Desktop
Sidebar navigation visible. Main content opens with a search bar and filter controls in a toolbar row, followed by a full-width data table with sortable columns. A bulk-action toolbar appears above the table when any rows are selected. "Add Member" and "Import CSV" buttons anchor the top-right header.

### Mobile
Filter controls collapse into a filter sheet triggered by a filter icon. Table becomes a scrollable card list — one card per member with name, status badge, and dues expiry. Tap a card to open member detail. Bulk actions accessed via long-press or a "Select" mode toggle.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search bar | Text input | Searches by name, email, or license number. Results filter live with 300ms debounce. |
| Status filter | Tab strip / dropdown | All / Active / Grace / Lapsed / Suspended / Pending. Selecting a tab immediately filters the table. |
| Category filter | Dropdown | All / per-org configured categories (Regular, Associate, Life, Student, Honorary, etc.). |
| Member table | Sortable data table | Columns: Name (linked to `/org/[id]/officer/roster/[id]`), License #, Category, Status badge (Active=green, Grace=yellow, Lapsed=red, Suspended=gray, Pending=blue), Dues Expiry (date or "N/A" for Life members), Joined date. All columns sortable. 50 rows per page with pagination. |
| Bulk action toolbar | Contextual toolbar | Appears when ≥1 row selected. Actions: Send dues reminder (to selected), Export selected to CSV, Change category (opens category selector modal for selected members). Shows selected count. |
| Add Member button | Primary button | Opens manual add-member form inline or as a modal: name, email, license#, phone, category. System checks for existing account by email or license# (normalized per M5-R2) and shows match result before confirming. |
| Import CSV button | Secondary button | Links to `/org/[id]/officer/roster/import`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton with shimmer rows |
| Empty | No members in org | "No members yet. Add members manually or import from CSV." with Add Member and Import CSV buttons |
| Filtered — no results | Filter or search yields nothing | "No members match your filters." with a "Clear filters" link |
| Populated | Members exist | Full table with pagination; status badges color-coded |
| Error | API failure | "Unable to load roster. Retry." with retry button |
| After bulk reminder | Reminder sent | Toast: "Reminder sent to N members." |
| After category change | Category updated | Toast: "Category updated for N members." |

## Interactions

- Search bar filters the member table live after each keystroke with a 300ms debounce. Filtering begins immediately when text is entered — no minimum character threshold. Clearing the search field restores the full (filtered-by-status) list.
- Status filter tabs and category dropdown apply instantly on selection — no separate "Apply" button. If status tab and category dropdown are both set, they combine as AND filters. Clicking "Clear filters" resets all filters and the search bar simultaneously.
- Clicking a member's name in the table navigates to `/org/[id]/officer/roster/[id]`. Clicking anywhere else in a row does not navigate (only the name link is interactive to avoid accidental navigation while selecting rows).
- Selecting one or more row checkboxes reveals the bulk action toolbar above the table. Deselecting all rows hides it again. The header checkbox selects all rows on the current page only (not all pages).
- "Send dues reminder" bulk action: shows a preview dialog — "Send reminder to N members. Each will receive a personalized payment link." Cancel dismisses. Confirm sends and shows toast "Reminder sent to N members."
- "Change category" bulk action: opens a category selector modal listing all active org categories. Selecting a category shows a confirmation: "Change N members to [Category]?" Confirm posts the change. Members already in the selected category are skipped silently.
- "Export selected to CSV" triggers an immediate download. If no rows are selected, the button is disabled.
- "Add Member" button opens an inline modal. As the officer types an email or license number, the system checks for existing accounts in real time (300ms debounce on the email/license fields) and shows a match banner: "This person already has an account — they will be linked to this org" or "No existing account found — a new account will be created." Confirming with an existing match links without duplication; confirming with no match sends a claim email to the new member.
- "Import CSV" is a link — it navigates to `/org/[id]/officer/roster/import` directly without a dialog.
