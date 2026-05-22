# Pricing & Plans

- **Route:** `/admin/pricing`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Allow Super Admins to define and manage the platform's subscription tier structure — member count brackets, monthly prices, trial durations, and included modules.

## Layout

Full-width configuration page. A top bar holds the page title and an "Add Tier" primary button. The main area is a table of pricing tiers, one row per tier. Below the table, a separate setting for the global default free trial duration. No left sidebar. Editing a tier opens a modal form; no inline cell editing.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Tier table | Table | Columns: Tier Name, Member Range (from–to), Monthly Price, Trial Duration (days), Included Modules (tag list), Active Subscriptions (count), Actions. |
| Member range | Display | "1–50 members," "51–200 members," etc. Shown as a readable range. |
| Monthly price | Display | Currency-formatted (platform currency). Shown as, e.g., "PHP 2,500 / month." |
| Included modules | Tag list | Abbreviated module names as small tags (e.g., "Auth," "Profile," "Dues"). |
| Active subscriptions count | Display | Number of orgs currently on this tier. If > 0, the tier cannot be deleted. |
| Edit button | Icon button per row | Opens the edit modal for this tier. |
| Delete button | Icon button per row | Disabled if the tier has active subscriptions. Enabled if count = 0. Requires confirmation dialog. |
| "Add Tier" button | Primary button | Opens the add tier modal. |
| Add/Edit tier modal | Modal form | Fields: Tier Name (text input), Member Range Min (number), Member Range Max (number, or "Unlimited" toggle), Monthly Price (currency input), Trial Duration (days, number), Included Modules (checkbox list of all platform modules). Validation: member ranges cannot overlap any existing tier. Save button. |
| Default trial duration | Standalone input | A single number input below the tier table: "Global default free trial duration: [N] days." Applies to new orgs when no explicit trial period is set at provisioning. "Save" button beside it. |
| Overlap validation | Inline error | If the member range min–max overlaps an existing tier, the range fields turn red: "Member ranges cannot overlap. [Tier Name] covers [range]." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Table skeleton. |
| Empty | No tiers configured | "No pricing tiers configured yet. Add your first tier to enable org subscriptions." with "Add Tier" button. |
| Modal open | Add or Edit clicked | Form modal overlays the page. Page background dims. |
| Range conflict | New/edited range overlaps existing | Inline validation error on the range fields. Save button disabled. |
| Delete blocked | Tier has active subscriptions | Delete button is disabled; tooltip: "Cannot delete a tier with active subscriptions. Migrate orgs first." |
| Delete with no subscriptions | Delete button clicked | Confirmation: "Are you sure you want to delete the [Tier Name] tier? This cannot be undone." |
| Save success | Modal saved | Modal closes; table updates with the new/modified tier. Toast: "Tier saved." |
| Save error | API error on save | Modal remains open. Error message inside the modal: "Could not save tier. Please try again." |

## Interactions

- Pricing changes apply to new subscriptions only (rule M3-R8). A persistent note in the page header reads: "Pricing changes apply to new subscriptions. Existing subscriptions remain on their current pricing until renewal."
- Deleting a tier with active subscriptions is blocked at the UI level; the delete button is disabled with a tooltip explaining why.
- Module checkboxes in the modal reflect the current feature flag matrix but can be configured independently for the tier (the feature flag matrix and the tier module list are distinct; the tier module list is the commercial offering, the feature flag matrix is the technical enablement).
- The default trial duration setting affects all new org provisioning where no explicit trial end date is provided; it does not retroactively change existing trials.
- Column sorting is available for Tier Name, Member Range, Monthly Price, and Active Subscriptions.
