# Feature Flags

- **Route:** `/admin/feature-flags`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Let Super Admins control which platform modules are available to which subscription tiers and override those settings for individual organizations.

## Layout

Full-width matrix page. The main content area is a grid table: module names as row headers down the left, subscription tier names as column headers across the top, and a toggle switch in each cell. Below the matrix, a divider separates the "Org-Level Overrides" section: a search bar to find a specific org, followed by a per-org module override list when an org is selected. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Matrix table | Grid | Rows = platform modules (M1 Auth, M2 Profile, M3 Admin, M4 Roster, M5 Membership, M6 Dues, M7 Elections, M8 Documents, M9 Training, M10 Credits, M11 Announcements, M13 Feed, etc.). Columns = subscription tiers (Free, Standard, Premium, plus any custom tiers). Each cell: toggle switch (on/off). |
| Module row header | Text + description | Module name + one-line description. The Auth module (M1) row shows a lock icon; its toggles are permanently on and non-interactive. |
| Tier column header | Text | Tier name + member count range in parentheses. |
| Cell tooltip | Hover tooltip | "Events module for Standard tier: currently ON for [N] orgs." Appears on hover of any cell. |
| Toggle | Interactive switch | Clicking changes state immediately (optimistic update). If the toggle is for a module being disabled and orgs in that tier have active data, the warning dialog interrupts before the save. |
| Warning dialog | Modal | "This module has active data in [N] orgs in the [tier] tier. Disabling will hide these from users. All data is preserved and will reappear if re-enabled. [Confirm disable] [Cancel]" |
| Org override search | Text input | Searches for an org by name; debounced 300ms. Shows suggestions after 2 characters. |
| Org override panel | Expandable list | Appears below the search when an org is selected. Lists all modules with the org's current override state: "Inherited (On)," "Inherited (Off)," "Override: On," "Override: Off." Each row has a toggle to set an override or remove it. |
| Override warning dialog | Modal | Triggered when disabling a module for an org that has active data in it. Shows count of active records (e.g., "15 upcoming events"). Same confirm/cancel pattern as the tier-level warning. |
| "Clear Override" | Inline button | Reverts the org's module flag to inherit from the tier. |
| Override conflict note | Inline label | If an org-level override conflicts with a tier toggle (e.g., org has "Override: On" but the tier is now "Off"), shows: "Override takes precedence. Org will still see this module." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Matrix skeleton with placeholder cells. |
| Default | Page loaded | Matrix shows all current toggle states. No org override panel visible. |
| Toggle saving | Toggle clicked | Cell shows a small loading spinner; toggle temporarily non-interactive. On success: state confirmed. On failure: toggle reverts; toast "Could not update feature flag. Please try again." |
| Org search: no results | Query returns empty | "No organization found matching '[query]'." |
| Org selected | Search result clicked | Org override panel expands below the search bar with the org name as the section header. |
| No overrides configured | Org selected, no existing overrides | "No per-org overrides configured for this org. All modules are inherited from the [tier] tier." |
| Error | Page data fails to load | "Could not load feature flags. Refresh to try again." |

## Interactions

- Matrix toggles save immediately; there is no "Save all" button. Each toggle change is its own API call.
- The Auth module (M1) toggle is visually locked (greyed out, no hover interaction). A tooltip explains: "Auth & Onboarding cannot be disabled."
- An org override toggle takes precedence over the tier matrix; the override conflict note ensures this is visible.
- Changes are logged in the platform audit trail with: admin ID, module, tier or org scope, old state, new state, timestamp.
- After the warning dialog is confirmed, the toggle change completes immediately.
