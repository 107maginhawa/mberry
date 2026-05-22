# Marketplace Vendor Management

- **Route:** `/admin/marketplace/vendors`
- **Module:** M17 Marketplace
- **Access:** Platform Admin (all roles)
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a searchable list of all marketplace vendor accounts — pending verification, verified, and suspended — so they can review new applications and manage existing vendor status.

## Layout

Full-width list page. A top bar holds a search input and a status filter. If any vendors are pending verification, a highlighted priority section appears above the main table, listing those vendors with "Review" buttons. Below the priority section (if any), the full vendor table with pagination. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search | Text input | Searches by company name or product/service name; debounced 300ms. |
| Status filter | Dropdown | All, Pending, Verified, Suspended. |
| Pending priority section | Highlighted group | Amber background header: "Pending Verification ([N])." Each pending vendor shows: company name, category, application date, "Review" button linking to vendor detail. Hidden when no pending vendors exist. |
| Vendor table | Sortable table | Columns: Company Name (linked to vendor detail), Category (EMR/Clinic Software, Dental & Medical Supplies, Insurance Products, Telehealth Services), Status badge (Pending = amber, Verified = green, Suspended = red), Active Listings (count), Application Date. |
| Status badge | Inline badge | Color-coded per status. Verified vendors display a "Verified" badge matching the one shown to members in marketplace listings. |
| Active listings count | Display | Number of active (visible to members) listings for this vendor. |
| Category badge | Inline badge | Color-coded or icon-coded per marketplace category. |
| Pagination | Footer | 25 rows per page. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Empty | No vendors yet | "No vendor applications yet. Vendors apply through the marketplace vendor portal." |
| Pending section present | Vendors awaiting review | Priority section appears above the table. |
| Pending section absent | No pending vendors | Table renders without the priority section; standard layout. |
| Filtered, no results | Filter returns zero | "No vendors match your filters." with "Clear filters" link. |
| Error | Fetch fails | "Could not load vendors. Retry." with retry button. |

## Interactions

- Row click navigates to `/admin/marketplace/vendors/[id]`.
- "Review" button in the pending section navigates directly to the vendor detail page.
- Status filter and search are additive (AND logic).
- Active listings count link navigates to the member-facing marketplace filtered to that vendor's listings (for reference, opens in a new tab).
- Sorting: Company Name (A–Z / Z–A), Application Date (newest/oldest), Status, Active Listings count.
