# Ad Placement Configuration

- **Route:** `/admin/advertising/placements`
- **Module:** M16 Advertising
- **Access:** Platform Admin (Super)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Let Super Admins configure the available advertising inventory — which ad slots exist, where they appear, how they're priced, and how many campaigns can run concurrently in each slot.

## Layout

Full-width configuration table page. A top bar holds the page title and a "New Placement" primary button. The main area is a table of all configured placements. Per-row action buttons allow editing or toggling status. Clicking "New Placement" or a row's "Edit" button opens a form panel (slide-in or modal). No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Placements table | Table | Columns: Placement Name, Association (or "All Associations"), Format (badge), Pricing Model (CPM / Flat Monthly), Rate (PHP), Max Concurrent Campaigns, Active Campaigns (current vs. max, e.g., "1 / 2"), Status (Active / Paused). |
| Format badge | Inline badge | Banner — Top of Feed, Banner — Sidebar, Sponsored Feed Post, Directory Listing Highlight. Color-coded by format type. |
| Active campaigns indicator | Display | "N / Max" where N = current live campaigns booked into this slot. Red if at capacity. |
| "New Placement" button | Primary button | Opens the placement creation form. |
| "Edit" button | Inline per row | Opens the edit form for that placement, pre-populated with current values. |
| "Pause / Activate" toggle | Inline per row | Immediately pauses or activates the placement. Pausing a placement with active campaigns shows a warning: "This placement has [N] active campaigns. Pausing will prevent new campaigns from booking this slot, but will not stop delivery on existing campaigns." |
| Placement form (New / Edit) | Modal or slide-in panel | Fields: Placement Name (text, required, unique within association), Association (dropdown: select one or "All Associations"), Format (radio: 4 options), Pricing Model (radio: CPM / Flat Monthly Rate), Rate in PHP (numeric, required, > 0), Maximum Concurrent Campaigns (numeric, min = 1), Impression Cap per Campaign (numeric, shown only when Pricing Model = CPM), Status (toggle: Active / Paused). Save and Cancel buttons. |
| Validation: impression cap | Conditional field | Required when CPM pricing is selected. Hidden for flat monthly. |
| Validation: duplicate name | Inline error | "A placement with this name already exists for [association]." on blur. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Empty | No placements configured | Guidance message: "No ad placements have been configured. Set up your first placement to enable advertisers to book campaigns." with "New Placement" button. |
| Form open | New Placement or Edit clicked | Form panel slides in or modal opens; table dims. |
| Placement at capacity | Active campaigns = max concurrent | Active campaigns indicator turns red. Tooltip: "This slot is fully booked. No new campaigns can be added until an existing campaign ends." |
| Pausing with active campaigns | Pause toggle clicked on a placement with active campaigns | Warning dialog before confirming. Existing active campaigns continue delivery; new bookings are blocked. |
| Save success | Form saved | Panel/modal closes; table updates. Toast: "Placement saved." |
| Save error | API error | Error message inside the form panel. Form remains open. |
| Error | Table fetch fails | "Could not load placements. Retry." |

## Interactions

- Pricing model change in the form (CPM ↔ Flat Monthly) toggles the Impression Cap field visibility.
- "All Associations" placements appear as available inventory to advertisers targeting any association.
- Association-specific placements appear only when an advertiser targeting that association creates a campaign.
- Placement edits take effect immediately but do not retroactively alter existing campaign bookings.
- All placement creation, edits, and status changes are logged in the platform audit trail.
