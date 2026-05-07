# Phase 1: Billing Schema Completion - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the billing module: fill all TODO schema fields so handlers read from DB instead of hardcoding defaults, add role-based access controls to billing endpoints, and write E2E tests covering the full invoice lifecycle (create, finalize, pay, void).

</domain>

<decisions>
## Implementation Decisions

### Line Items Storage
- **D-01:** ~~Store line items as a JSONB column~~ **AMENDED:** Keep existing `invoice_line_items` separate table (already built and working in createInvoice). Migration to JSONB adds risk for no benefit. TypeSpec defines `InvoiceLineItem` with `description`, `quantity`, `unitPrice`, `amount`, `metadata` — these fields exist on the line items table already.

### Access Control Model
- **D-02:** Admin-only for write operations (create, update, finalize, void invoices; manage merchant accounts). Customers can read their own invoices filtered by `customer = authenticated person ID`. No cross-customer access.
- **D-03:** Use Better-Auth session + role check pattern already established in other handlers. Admin role check via middleware or inline guard — follow whichever pattern exists in the codebase.

### Invoice Lifecycle Flow
- **D-04:** Valid transitions: `draft → open → paid` and `draft → open → void`. No reopening voided invoices. Finalize = draft → open.
- **D-05:** Refunds are out of scope for this phase. Future phase will add refund as a separate entity linked to the original invoice.
- **D-06:** Void threshold enforcement: if `voidThresholdMinutes` is set, void is blocked after the threshold passes from `paidAt`. Otherwise void is always allowed on open invoices.

### Metadata & Context Usage
- **D-07:** `context` field (varchar) is an idempotency key for deduplication — format: `{entity}:{period}:{identifier}` (e.g., `dues:2026-Q1:member-123`). Unique constraint prevents duplicate invoices for the same context.
- **D-08:** `metadata` field (JSONB) stores arbitrary tracking data — dues period, chapter reference, notes. No enforced schema on metadata contents.

### Claude's Discretion
- Schema field additions that already exist in TypeSpec but are missing from handlers (authorizedAt, authorizedBy, etc.) — wire them through without discussion
- Migration generation approach (standard Drizzle `db:generate`)
- Test fixture structure for billing E2E tests — follow Phase 0 deterministic fixture pattern
- Handler refactoring to read from DB columns instead of hardcoded defaults

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Billing API Specification
- `specs/api/src/modules/billing.tsp` — TypeSpec source of truth for billing models, enums, and endpoints
- `specs/api/dist/openapi/openapi.json` — Generated OpenAPI spec (billing section)

### Billing Implementation
- `services/api-ts/src/handlers/billing/repos/billing.schema.ts` — Current Drizzle schema (has most fields, handlers don't use them)
- `services/api-ts/src/handlers/billing/listInvoices.ts` — 8 TODO markers showing hardcoded defaults
- `services/api-ts/src/handlers/billing/getInvoice.ts` — 9 TODO markers including admin access check
- `services/api-ts/src/handlers/billing/finalizeInvoice.ts` — 2 TODO markers for paymentDueAt and lineItems

### Testing Protocol
- `VERTICAL_TDD.md` — Test-first development protocol for this project
- `.planning/REQUIREMENTS.md` — BILL-01 through BILL-04 requirement definitions

### Project Requirements
- `.planning/ROADMAP.md` — Phase 1 success criteria (4 items)
- `.planning/PROJECT.md` — Core value and constraints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Billing Drizzle schema already has `paymentCaptureMethod`, `paidBy`, `voidedBy`, `authorizedAt`, `authorizedBy`, `voidThresholdMinutes` columns defined — handlers just ignore them
- `captureMethodEnum`, `invoiceStatusEnum`, `paymentStatusEnum` Drizzle enums already exist
- Phase 0 deterministic fixture pattern for E2E test data

### Established Patterns
- Handler pattern: Router → Validators → Handlers → Repositories (all billing handlers follow this)
- BaseEntity fields (id, timestamps, version, audit) inherited via `baseEntityFields`
- Person-centric FK relationships (`customer`, `merchant` both reference `persons.id`)

### Integration Points
- Better-Auth session for role-based access (admin check pattern from other modules)
- Merchant accounts table already exists with Stripe integration fields
- Invoice number auto-generation already implemented

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all decisions to Claude's judgment based on codebase patterns and domain context.

</specifics>

<deferred>
## Deferred Ideas

- Refund handling (separate entity linked to original invoice) — future phase
- Stripe webhook integration for payment status updates — future phase
- Invoice PDF generation — future phase
- Recurring billing / subscription support — future phase

</deferred>

---

*Phase: 01-billing-schema-completion*
*Context gathered: 2026-05-06*
