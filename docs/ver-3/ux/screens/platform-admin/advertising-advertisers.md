# Advertiser List

- **Route:** `/admin/advertising/advertisers`
- **Module:** M16 Advertising
- **Access:** Platform Admin (all roles)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a searchable list of all advertiser accounts — pending, approved, and suspended — with quick access to review new applications and manage existing accounts.

## Layout

Full-width list page. A top bar has a search input and status filter. Below the top bar, if any advertisers are in "Pending" status, a highlighted priority section appears with those accounts listed first with prominent "Review" buttons. Below the priority section, the full advertiser table. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search | Text input | Search by company name; debounced 300ms. |
| Status filter | Dropdown | All, Pending, Approved, Suspended. |
| Pending priority section | Highlighted group | Appears when any advertisers are Pending. Amber background header: "Awaiting Approval ([N])." Each pending row shows company name, type, application date, and a "Review" button linking to the advertiser detail page. |
| Advertiser table | Table | Columns: Company Name (linked to advertiser detail), Type (pharma / medical device / dental supplier / education / other B2B vendor), Status badge (Pending = amber, Approved = green, Suspended = red), Active Campaigns (count), Total Lifetime Spend (PHP), Application Date. Sortable by Company Name, Status, Total Spend, and Application Date. |
| Status badge | Inline badge | Color-coded. Pending advertisers show a pulsing amber dot. |
| Active campaigns count | Display | Linked: clicking navigates to `/admin/advertising/campaigns?advertiser=[id]`. |
| Pagination | Footer | 25 rows per page. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Empty | No advertisers yet | "No advertiser accounts yet. Advertisers submit applications through the advertiser portal." |
| Pending section empty | All advertisers approved or suspended | Priority section not shown. |
| Filtered, no results | Filter returns zero | "No advertisers match your filters." with "Clear filters" link. |
| Error | Fetch fails | "Could not load advertisers. Retry." |

## Interactions

- Row click navigates to `/admin/advertising/advertisers/[id]`.
- "Review" button in the pending section navigates directly to the advertiser detail page's approval section.
- Active campaigns count link navigates to the campaigns list pre-filtered by that advertiser.
- Approved advertisers with zero active campaigns show "0" in the Active Campaigns column.
- Suspended advertisers are shown with a red status badge; all their campaigns are paused (visible in the Active Campaigns count as 0 even if campaigns exist but are paused).
