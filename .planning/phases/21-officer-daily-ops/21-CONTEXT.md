# Phase 21: Officer Daily Ops - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Officers get a functional chapter management dashboard: roster with dues/training status, bulk membership approvals with partial success responses, and status filters — all validated at per-record org scope. Backend + frontend.

</domain>

<decisions>
## Implementation Decisions

### Roster Endpoint
- Single endpoint returns roster with joined data: member name, dues status, training credit summary
- Server-side JOIN (no N+1) — single query joining person, membership, dues, training tables
- Org-scoped: officer sees only their chapter's members
- Supports pagination (existing OffsetPaginationParams pattern)

### Bulk Membership Approvals
- Endpoint accepts array of application IDs to approve
- Returns partial-success response: `{ succeeded: [...], failed: [{id, reason}] }`
- Each approval validated individually — org scope checked per record
- Officer cannot approve applications from other chapters even in mixed-org batch
- Wrap in transaction per-record (not all-or-nothing) to support partial success

### Status Filters
- Roster filterable by: membership status, dues status, training compliance
- Query params: `?membershipStatus=active&duesStatus=overdue&trainingCompliant=true`
- Filters applied at DB level (WHERE clauses), not client-side

### Claude's Discretion
All implementation details at Claude's discretion. Follow existing handler patterns with requirePosition for officer endpoints. Use existing roster/member endpoints if they exist, extend them.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Association member handlers (157 handlers) — likely roster endpoint exists
- Membership schema with status field
- Dues status from invoice/payment data
- Training credits from credit entries
- requirePosition utility for officer auth
- OffsetPaginationParams for paginated endpoints

### Integration Points
- Person table (name, PII)
- Membership table (status, org association)
- Dues invoices/payments (dues status derivation)
- Training credits (compliance status)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user defers to best practices.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
