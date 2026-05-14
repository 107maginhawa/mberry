# Phase 23: Member Departure + Deceased - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Officers can record member resignation or death with proper status codes, and departed/deceased members are automatically excluded from dues billing and notification sends. Backend lifecycle changes + billing/notification guards.

</domain>

<decisions>
## Implementation Decisions

### Membership Status Enum Extension
- Extend membership status enum to include: `resigned`, `deceased`, `expelled`, `lapsed` (not boolean)
- Add `terminationReason` varchar field for context (e.g., "Voluntary resignation", officer notes)
- Add `dateOfDeath` date field on person record (already may exist via Better-Auth)
- Add `terminatedAt` timestamp for when status was changed

### Officer Actions
- Officer marks member as resigned: sets membership status to `resigned`, records reason and date
- Officer marks member as deceased: sets membership status to `deceased`, records date of death
- Both actions are irreversible (soft — admin can override but normal officers cannot undo)
- Require officer position (Treasurer, President, or Secretary)

### Billing Exclusion
- Dues invoice generation (`generateDuesInvoicesForOrg`) skips members with status `resigned`, `deceased`, `expelled`, or `lapsed`
- Existing open invoices for departed members are voided/cancelled

### Notification Exclusion
- Bulk notification sends skip members with departed/deceased status
- Email queue processor checks membership status before sending
- This is the guard that Phase 25 will consume

### Claude's Discretion
All remaining implementation details at Claude's discretion. Follow existing membership handler patterns.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Membership schema with status enum (may need extension)
- Membership state machine (Phase 15)
- generateDuesInvoicesForOrg handler (has requirePosition from Phase 18)
- Notification/email handlers

### Integration Points
- Membership status transitions
- Dues invoice generation WHERE clause
- Notification send pipeline

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user defers to best practices.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
