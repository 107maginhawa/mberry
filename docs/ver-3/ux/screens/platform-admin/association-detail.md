# Association Detail

- **Route:** `/admin/associations/[id]`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (all roles)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete view of a single association — its organizations, billing status, and configuration — and serve as the hub for all actions taken on that association.

## Layout

Full-width page. A header band shows the association name, country flag, status badge, and an "Edit" button (Super only). Below the header, four tabs provide access to distinct data domains: Overview, Organizations, Billing, and Configuration. The active tab's content fills the main area below the tab bar. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Header: name + country flag | Display | Large association name, ISO country flag icon beside it. |
| Status badge | Badge | Green = Active, amber = Suspended, red = Cancelled. |
| Edit button | Secondary button | Super Admin only. Opens an inline edit form over the Configuration tab fields. |
| Tab: Overview | Tab | Four stat cards: Org Count, Member Count, Active Rate (% of members with Active status), MRR. Below the cards: a condensed activity feed for this association's recent events (new org, subscription change, ticket). |
| Tab: Organizations | Tab | Data table of orgs within this association. Columns: Name, Type (chapter/society/national/clinic), Status (trial/active/suspended/cancelled), Member Count, Trial Expiry (if applicable), Health Score (0–100, color-coded). "Add Organization" primary button in the tab header. Row click opens org detail. |
| Tab: Billing | Tab | Current plan tier name, next billing date, payment method on file. Payment history table: date, invoice number, amount, status (paid/failed/refunded). "Extend Trial" button available per org in the trial state (opens a modal — see Interactions). "Retry Payment" button for any failed payment row. |
| Tab: Configuration | Tab | Editable fields for this association: license format regex (with test input), credit cycle period, required credits, carryover policy, currency, locale overrides. "Save" button at bottom. |
| Org health score | Color-coded number | Green 70–100, amber 40–69, red 0–39. Tooltip: "Health is computed from member login rate, payment activity, event creation, and feature adoption." |
| Trial expiry countdown | Inline label | "Expires in N days" in amber if ≤ 14 days; red if ≤ 3 days. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Tab switch or page load | Skeleton per tab content area. |
| No orgs | Organizations tab, none exist | "No organizations in this association yet." with "Add Organization" button. |
| No billing history | Billing tab, new association | "No billing activity yet. Billing history will appear once organizations activate a subscription." |
| Suspended association | Status = Suspended | Yellow banner across the top of the page: "This association is suspended. Org members have read-only access." |
| Cancelled association | Status = Cancelled | Red banner: "This association is cancelled. Data preserved for 90 days, then eligible for deletion." |
| Error per tab | Tab data fetch fails | Inline error message within the tab content area with a retry button. |

## Interactions

- Tab switching does not reload the page; each tab's data is fetched on first activation and cached for the session.
- "Add Organization" opens `/admin/associations/[id]/orgs/new` (or a modal form) and returns to the Organizations tab on success.
- "Extend Trial" on the Billing tab opens a modal: date picker for new trial end date + required reason field. On save, logs the extension in the audit trail.
- Clicking any row in the Organizations tab navigates to that org's detail page.
- "Retry Payment" on a failed billing row triggers an immediate retry with the payment method on file; outcome shown as a toast.
- Configuration tab fields are editable inline; "Save" triggers a confirmation: "Updating license format or locale may affect member record validation. Continue?" for regex or locale changes.
