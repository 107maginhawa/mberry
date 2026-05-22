# Member Directory

- **Route:** `/org/[id]/members`
- **Module:** M05 Membership
- **Access:** Member (must be active member of this org; Lapsed members see the directory but with limited access per org settings)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let members find fellow members of their org by name or license number, with contact and specialization information shown according to each member's privacy settings and the viewer's role.

## Layout

### Desktop
Left sidebar org navigation. Main content: a search bar at the top, below it optional filter chips, then a responsive card grid (3–4 columns). Tapping a card opens a member profile panel as a right-side drawer rather than navigating away, so the member can quickly scan through people without losing their search context.

### Mobile
Search bar pinned at the top. Filter chips in a horizontal scroll row below. Single-column card list. Tapping a card navigates to a full-screen member profile detail view (no drawer).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Search Bar | Input | Full-width, debounced 300ms. Searches by: member name (partial match), license number (normalized per M5-R2: strips dashes, spaces, leading zeros). Placeholder: "Search by name or license number." |
| Status Filter | Chip group | Active (default) / All. Default shows only Active members. "All" shows Active + Grace members (never shows Suspended or Removed members to fellow members). |
| Specialty Filter | Dropdown | Filter by member specialization. Populated from the specializations present in this org. "All specializations" default. |
| Member Card (member view) | Card | Member photo (if privacy allows; falls back to initials placeholder in org accent color). Full name. Specialization. Status badge (Active = green, Grace = amber). No contact info. |
| Member Card (officer view) | Card | Everything in member view, plus: email (if not set to hidden), phone (if not set to hidden), membership category badge, dues expiry date. |
| Profile Drawer / Detail | Panel or full screen | See Member Profile Detail below. |
| Empty State | Illustration + text | Context-sensitive by state. |
| Pagination | Load more | 20 members per page. "Load more" button at bottom (not infinite scroll — preserves scroll position when closing the drawer). |

### Member Profile Detail (drawer on desktop, full screen on mobile)

| Field | Member View | Officer View |
|-------|-------------|--------------|
| Photo | Shown if privacy allows | Always shown |
| Full name | Always shown | Always shown |
| License number | Always shown | Always shown |
| Specialization | Always shown | Always shown |
| Membership status badge | Always shown | Always shown |
| Membership category | Not shown | Shown |
| Email | Shown only if member set to visible (default: hidden) | Always shown |
| Phone | Shown only if member set to visible (default: hidden) | Always shown |
| Address | Never shown | Shown |
| Dues expiry | Not shown | Shown |
| Last login | Not shown | Shown |
| Joined date | Not shown | Shown |

Officers also see action buttons on the profile: "Change Category," "Record Payment" (links to M06), "Initiate Transfer," "Disciplinary Action" (links to M04 flow).

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton card grid (12 placeholder cards) with shimmer. |
| Empty — no active members | Org has no active members | "No active members in the directory yet." |
| Search — no results | Search query returns no matches | "No members found matching '[query]'." with a "Clear search" link. |
| Populated | Active members exist | Card grid. Count shown: "Showing 48 active members." |
| Filtered — no results | Status or specialty filter narrows to zero | "No members match your filters." with a "Clear filters" link. |
| Lapsed viewer | Viewing member has lapsed dues | Directory is visible per org settings. No actions available (cannot tap for contact). A banner above: "Your membership has lapsed. Some contact details are hidden." |
| Error | API failure | "Unable to load the member directory. Try again." with retry button. |

## Interactions

- **Search:** As the member types, results filter in real-time (300ms debounce). Both name and license number search are handled by the same input — the system detects whether the query looks like a license number (contains digits with possible dashes) and normalizes accordingly before querying.
- **Privacy enforcement:** Hidden fields are simply absent from the rendered profile — no "hidden" label is shown. Members do not know what they cannot see. Officers always see all fields.
- **Officers vs members:** The component renders two different card and profile variants based on the viewer's role in this org. This is determined server-side; no client-side role switching.
- **Suspended and Removed members** are never shown in the directory to fellow members. Officers can find them via the roster at `/org/[id]/officer/roster`, not here.
- **Public visitors** cannot access this route. The directory requires authentication and active org membership.
- **Status filter "Active" default:** Shows only members whose computed status is Active. "All" adds Grace-status members. This default keeps the directory feeling current — Grace members are included when "All" is selected since they are still members in good enough standing to appear.
