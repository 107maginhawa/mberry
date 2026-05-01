# Organization Detail

- **Route:** `/admin/orgs/[id]`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (all roles)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete profile of a single organization — its health, members, subscription, feature overrides, and lifecycle state — and the actions needed to manage or support it.

## Layout

Full-width page. A header band shows the org name, parent association (linked), org type badge, status badge, health score, and lifecycle action buttons (Super only). Below the header, five tabs: Overview, Members, Subscription, Features, and Activity. Each tab fills the content area below. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Header: org name | Display | Large org name, with parent association name as a clickable sub-label linking to `/admin/associations/[id]`. |
| Status badge | Badge | Trial / Active / Suspended / Cancelled, color-coded. |
| Health score | Large number + color | 0–100, color-coded green/amber/red. Tooltip: "Based on member login rate, payment activity, event creation, and feature adoption." |
| Lifecycle action buttons | Buttons | Super only. Context-sensitive per state machine: Trial shows "Convert to Active," "Extend Trial," "Cancel." Active shows "Suspend," "Cancel." Suspended shows "Reinstate," "Cancel." Cancelled shows "Reactivate" (if within 90 days). |
| Tab: Overview | Tab | Stat cards: Member Count, Active Members %, Last Officer Login, Last Payment Date. Below: health score breakdown (which factors contribute positively/negatively). Outreach action: "Send Outreach Email" and "Flag for Follow-up" buttons. |
| Tab: Members | Tab | Paginated table of members in this org: name, email, status, role (member/officer), last login, dues status. Search by name/email. No member PII is hidden at this level — admin has full access. |
| Tab: Subscription | Tab | Current plan, trial dates (if applicable), billing status, payment method, invoice history. Mirrors the association billing tab but scoped to this org. |
| Tab: Features | Tab | Module toggles as per-org overrides. Each module listed with: current override state (On/Off/Inherited from tier), a toggle, and the date of the last override change. Matches the override section of `/admin/feature-flags` but scoped to this org. |
| Tab: Activity | Tab | Chronological audit log for this org: new members added, payments, officer changes, feature flag overrides, admin actions. Filterable by action type and date range. |
| "Send Outreach Email" | Button | Opens a draft email addressed to the org's officers. Admin can edit and send. Action logged. |
| "Flag for Follow-up" | Button | Creates an internal follow-up reminder visible on the admin dashboard. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load / tab switch | Skeleton per section. |
| Suspended | Status = Suspended | Amber banner: "This org is suspended. Members have read-only access. Data is preserved." Reinstate button is prominent. |
| Cancelled | Status = Cancelled | Red banner: "This org is cancelled. Data preserved until [deletion eligibility date]." |
| No members | Members tab, empty org | "No members in this org yet. Members are added by the org's officers." |
| No activity | Activity tab, brand new org | "No activity recorded yet. Actions taken by officers and admins will appear here." |
| Error | Any tab fetch fails | Inline error with retry within the tab. |

## Interactions

- Lifecycle transitions trigger a confirmation dialog with a description of effects and a required reason field; transition is logged in the audit trail and the org's officers are notified.
- Member duplicate merge: if the Members tab shows members flagged as potential duplicates (same license number, different emails), an "Review Duplicates" banner appears at the top of the tab with a link to the merge tool.
- Feature toggle changes in the Features tab take effect immediately; if the module has active data, a warning dialog appears before the toggle completes (matching the behavior in `/admin/feature-flags`).
- "Send Outreach Email" logs the outreach in the Activity tab.
- Clicking a member row in the Members tab navigates to `/admin/members/[id]`.
