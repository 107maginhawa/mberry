# Phase 20: Payment Flow - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Officers can record offline dues payments (GCash, bank transfer), generate member-viewable receipts, and the system prevents double-payment via optimistic locking. Backend + frontend.

</domain>

<decisions>
## Implementation Decisions

### Offline Payment Recording
- Officer records payment against an open invoice specifying: payment method (GCash/bank transfer/cash/check), reference number, amount
- On record: payment status set to 'completed', invoice status updated to 'paid', `paidAt` timestamped
- `recordedBy` set to officer's personId from session
- Use existing `recordDuesPayment.ts` handler — implement/fix business logic

### Receipt Generation
- Receipt number auto-generated on successful payment (format: `REC-{orgPrefix}-{timestamp}-{seq}`)
- Receipt record is the payment record itself — `duesPayments` table already has `receiptNumber`
- Member can view their own receipts via `/person/me/payments` or similar self-service endpoint
- Officer can view receipts for chapter members (org-scoped)

### Double-Payment Prevention
- Use `version` field from `baseEntityFields` for optimistic locking on invoice status update
- When recording payment: read invoice version → update invoice SET status='paid' WHERE version=N → if 0 rows affected, throw ConflictError (409)
- This prevents two officers from simultaneously recording payment on the same invoice

### Member Receipt Visibility
- Members see their own payment history with receipt numbers via self-service endpoint
- No full receipt PDF needed for MVP — just payment record with receipt number, amount, date, method

### Claude's Discretion
All remaining implementation details at Claude's discretion. Follow existing dues handler patterns. Use existing schema (no new tables needed). Implement optimistic locking via WHERE version=N on invoice update.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `duesPayments` table schema with all needed columns (receiptNumber, paymentMethod, referenceNumber, status, recordedBy, version)
- `recordDuesPayment.ts` handler exists (has requirePosition from Phase 18)
- `getDuesPayment.ts`, `listDuesPayments.ts` handlers exist (org-scoped from Phase 18)
- `duesPaymentMethodEnum` and `duesPaymentStatusEnum` enums exist
- Unique constraint on `receiptNumber` already in schema
- `ConflictError` class exists in `core/errors.ts`

### Established Patterns
- Dues handler pattern with requirePosition + org scope (from Phase 18)
- Version-based optimistic locking via baseEntityFields.version
- Transaction wrapping for multi-table updates (from Phase 18 CR-03 fix)

### Integration Points
- Invoice table: `duesInvoices` with status field to update on payment
- Payment recording triggers invoice status change
- Member self-service: extend person handlers or create dues self-service endpoints

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user defers to best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
