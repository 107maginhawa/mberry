# System Logs

- **Route:** `/admin/system/logs`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give Super Admins an immutable, searchable audit trail of every data-changing action taken on the platform — by admins, officers, and members — for compliance, debugging, and incident investigation.

## Layout

Full-width log viewer page. A filter bar across the top provides controls for actor, action type, date range, and association. Below the filter bar, a dense, paginated log table shows entries in reverse chronological order (newest first). Clicking a row expands it inline to show the full event payload. An export button in the top-right generates a filtered CSV. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Actor filter | Search + dropdown | Accepts a name or email; suggests matching admins and members. Filters the log to entries where the specified person took the action. |
| Action type filter | Multi-select dropdown | Categories: Authentication, Impersonation, Org Lifecycle, Feature Flags, Billing, Member Data, Support Tickets, Role Management, Data Export/Deletion, Announcements, Configuration. |
| Date range filter | Date range picker | From / To date inputs. Default: last 7 days. Maximum selectable range: 90 days per query. |
| Association filter | Dropdown | Filters to log entries scoped to a specific association. "Platform-wide" option includes unscoped actions (e.g., admin role changes). |
| Log table | Dense table | Columns: Timestamp (local time + UTC offset), Actor (name + role), Action Type (badge), Description (human-readable summary), Scope (association + org if applicable), Outcome (Success / Failed / Blocked). |
| Row expansion | Inline expand | Clicking a row shows the raw event payload: changed field names, old values, new values (PII redacted in display per DPA), request ID, and IP address of the actor. |
| Action type badge | Colored badge | Color-coded by category (e.g., Impersonation = orange, Billing = green, Org Lifecycle = blue). |
| Export button | Secondary button | Exports the current filtered view as CSV. File name: `memberry-audit-log-[date-range].csv`. |
| Pagination | Footer | 50 rows per page; next/previous and jump-to-page controls. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load or filter change | Table skeleton with placeholder rows. |
| Default | Page loaded, 7-day default | Table shows last 7 days of all log entries, newest first. |
| Filtered | Any filter applied | Table updates with matching entries. Active filters shown as removable chips below the filter bar. |
| No results | Filter returns zero entries | "No log entries match your filters. Try adjusting the date range or actor." |
| Row expanded | Row clicked | Row expands in place; other rows remain visible. Clicking the row again collapses it. |
| Export generating | Export button clicked | Button shows spinner. For large result sets (> 10,000 rows), a message: "Large export in progress. This may take up to 30 seconds." File downloads when ready. |
| Error | Table fetch fails | "Could not load system logs. Retry." with retry button. |

## Interactions

- The audit log is immutable — no delete, edit, or redact controls exist in the UI. This is by design (rule M3-R13).
- PII in log entries is displayed in a limited form in the UI: member names and emails are shown; license numbers are partially masked (e.g., `PRC-*****78`). Full unmasked data is available in the CSV export for authorized Super Admins only.
- The log table is not sortable (always newest-first) to maintain the integrity of the temporal audit trail. Filters are the only way to narrow results.
- Impersonation log entries show both the impersonator's admin ID and the impersonated member's ID in the Actor column: "[Admin Name] as [Member Name]."
- Export CSV contains: timestamp, actor_id, actor_name, actor_role, action_type, description, association_id, org_id (if applicable), outcome, request_id, ip_address. PII is included in the export (for authorized use).
