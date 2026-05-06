# Phase 1: Billing Schema Completion - Research

**Researched:** 2026-05-06
**Domain:** Drizzle ORM schema alignment, Hono handler refactoring, role-based access control
**Confidence:** HIGH

## Summary

The billing module schema (`billing.schema.ts`) already contains all required columns (paymentCaptureMethod, paidBy, voidedBy, authorizedAt, authorizedBy, voidThresholdMinutes, metadata, context, lineItems table). The problem is purely at the handler layer: `listInvoices.ts`, `getInvoice.ts`, and `finalizeInvoice.ts` hardcode `null` or placeholder values instead of reading from the DB columns that already exist.

The `createInvoice.ts` handler already correctly writes and reads all fields. `voidInvoice.ts` and `captureInvoicePayment.ts` already have admin role checks. The fix is mechanical: update the response formatting in 3 handlers to read actual DB values, add admin role checks to handlers missing them, add customer-scoped read filtering to list/get, and write E2E tests.

**Primary recommendation:** This is a refactoring + access control + test phase. No schema migration needed (columns exist). Focus on handler response mapping, consistent admin checks, and E2E lifecycle tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Line items as JSONB on invoice table (NOTE: actual implementation uses separate `invoice_line_item` table — already built, keep it)
- D-02: Admin-only for write ops; customers read own invoices filtered by customer = authenticated person ID
- D-03: Better-Auth session + role check pattern (inline guard, as used in voidInvoice.ts)
- D-04: Valid transitions: draft -> open -> paid, draft -> open -> void. No reopening voided.
- D-05: Refunds out of scope
- D-06: Void threshold enforcement (voidThresholdMinutes blocks void after threshold from paidAt)
- D-07: context field is idempotency key with unique constraint (already implemented)
- D-08: metadata field is arbitrary JSONB (already implemented)

### Claude's Discretion
- Wire existing schema fields through handlers (mechanical fix)
- Migration generation approach (standard Drizzle db:generate)
- Test fixture structure (follow Phase 0 deterministic pattern)
- Handler refactoring approach

### Deferred Ideas (OUT OF SCOPE)
- Refund handling (separate entity)
- Stripe webhook integration for payment status updates
- Invoice PDF generation
- Recurring billing / subscription support
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-01 | Invoice creation includes all fields (paymentCaptureMethod, lineItems, paidBy, voidedBy, etc.) | createInvoice.ts already does this correctly. listInvoices/getInvoice/finalizeInvoice need response mapping fix. |
| BILL-02 | Billing Drizzle schema matches TypeSpec billing definitions with no drift | Schema already has all columns. Verify no drift by comparing billing.schema.ts columns against TypeSpec billing.tsp model fields. |
| BILL-03 | Non-admin users cannot access billing management endpoints | voidInvoice/capturePayment/refund already have admin checks. createInvoice/finalizeInvoice/updateInvoice/deleteInvoice need admin guards added. listInvoices/getInvoice need customer-scoped filtering. |
| BILL-04 | E2E tests verify full invoice lifecycle (create, pay, void, refund) | 4 unit test files exist. Need integration/E2E tests covering full lifecycle. Refund is deferred per D-05, so lifecycle = create -> finalize -> pay -> void. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema alignment | Database / Storage | — | Column definitions in Drizzle schema |
| Handler response mapping | API / Backend | — | Response formatting lives in Hono handlers |
| Access control (admin) | API / Backend | — | Role check in handler or middleware |
| Customer-scoped reads | API / Backend | — | Filter query by authenticated user ID |
| E2E tests | API / Backend | — | Backend-only (no frontend in this phase) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (existing) | Schema + queries | Already in use, type-safe SQL |
| Hono | (existing) | HTTP handlers | Already in use |
| Better-Auth | (existing) | Session + roles | Already in use for auth |
| Bun test | (existing) | Unit + integration tests | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | (existing) | Migration generation | Only if schema changes needed |

No new dependencies required for this phase. [VERIFIED: codebase inspection]

## Architecture Patterns

### System Architecture Diagram

```
[HTTP Request] 
    → [Auth Middleware (Better-Auth session)]
    → [Role Check (inline guard)]
    → [Handler (business logic + response formatting)]
    → [Repository (Drizzle queries)]
    → [PostgreSQL]
```

### Pattern 1: Admin Role Check (Inline Guard)
**What:** Check user.role for admin before allowing write operations
**When to use:** All billing write endpoints (create, update, finalize, void, delete)
**Example:**
```typescript
// Source: services/api-ts/src/handlers/billing/voidInvoice.ts (lines 56-59)
const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
const isAdmin = userRoles.includes('admin');

if (!isAdmin) {
  // For non-admins, check if user is the merchant on the invoice
  if (user.id !== invoice.merchant) {
    throw new ForbiddenError('You can only void your own invoices');
  }
}
```

### Pattern 2: Customer-Scoped Read
**What:** Non-admin users can only see invoices where they are customer or merchant
**When to use:** listInvoices, getInvoice
**Example:**
```typescript
// Source: services/api-ts/src/handlers/billing/getInvoice.ts (lines 69-72)
if (invoice.merchant !== user.id && invoice.customer !== user.id) {
  // Add admin bypass
  const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
  if (!userRoles.includes('admin')) {
    throw new ForbiddenError('You can only access invoices where you are the merchant or customer');
  }
}
```

### Pattern 3: Response Field Mapping (Fix TODOs)
**What:** Read actual DB column values instead of hardcoding null
**When to use:** All invoice response formatting blocks
**Example:**
```typescript
// BEFORE (broken):
paymentCaptureMethod: 'automatic', // TODO: Add to schema
paidBy: null, // TODO: Add to schema

// AFTER (correct — columns already exist in schema):
paymentCaptureMethod: invoice.paymentCaptureMethod,
paidBy: invoice.paidBy,
voidedBy: invoice.voidedBy,
voidThresholdMinutes: invoice.voidThresholdMinutes,
authorizedAt: invoice.authorizedAt?.toISOString() || null,
authorizedBy: invoice.authorizedBy,
metadata: invoice.metadata,
```

### Pattern 4: Line Items from Separate Table
**What:** Query invoice_line_items table and include in response
**When to use:** getInvoice (single), listInvoices (batch)
**Example:**
```typescript
// Source: billing.repo.ts findOneWithLineItems method
const invoice = await this.findOneById(id);
const lineItems = await this.db
  .select()
  .from(invoiceLineItems)
  .where(eq(invoiceLineItems.invoice, id));
return { ...invoice, lineItems };
```

### Anti-Patterns to Avoid
- **Hardcoding response fields:** Never return `null` when the DB column exists and has data
- **Inconsistent admin check patterns:** Use the same `userRoles.includes('admin')` pattern everywhere (not `user.role === 'admin'`)
- **Fetching line items in list endpoint without pagination awareness:** For list, consider whether to include line items or make it an expand option

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session | Custom JWT parsing | Better-Auth `ctx.get('session')` | Already integrated |
| Role checks | Middleware decorator | Inline guard pattern | Matches existing billing handlers |
| Invoice number generation | Manual counter | `invoiceRepo.generateInvoiceNumber()` | Already handles year prefix + collision |
| Line items storage | JSONB column | Existing `invoice_line_items` table | Already built with proper FK cascade |

## Common Pitfalls

### Pitfall 1: Line Items Storage Mismatch
**What goes wrong:** CONTEXT.md says JSONB column, but implementation uses separate table
**Why it happens:** Decision D-01 was made before seeing codebase already has `invoice_line_items` table
**How to avoid:** Keep the existing separate table implementation — it's already working in createInvoice
**Warning signs:** Don't add a JSONB `lineItems` column to invoices table

### Pitfall 2: Inconsistent Admin Check Pattern
**What goes wrong:** Some handlers use `user.role === 'admin'`, others use `user.role.split(',').includes('admin')`
**Why it happens:** Different handlers written at different times
**How to avoid:** Use the split+includes pattern consistently (supports comma-separated multi-role)
**Warning signs:** Single-equality checks that break for users with multiple roles

### Pitfall 3: Missing Line Items in List Response
**What goes wrong:** N+1 query problem when fetching line items for every invoice in a list
**Why it happens:** Naive implementation does one query per invoice
**How to avoid:** Batch-fetch all line items for the page in one query, then map to invoices
**Warning signs:** Slow list endpoint with many invoices

### Pitfall 4: Void Threshold Check Not Implemented
**What goes wrong:** D-06 requires checking voidThresholdMinutes before allowing void
**Why it happens:** Current voidInvoice.ts doesn't check this field
**How to avoid:** Add threshold check: if voidThresholdMinutes set and minutes since paidAt > threshold, block void
**Warning signs:** Voided invoices that should have been protected

## Code Examples

### Handler Response Format (Complete)
```typescript
// All invoice responses should use this format
const response = {
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  customer: invoice.customer,
  merchant: invoice.merchant,
  context: invoice.context || null,
  status: invoice.status,
  subtotal: invoice.subtotal,
  tax: invoice.tax || null,
  total: invoice.total,
  currency: invoice.currency,
  paymentCaptureMethod: invoice.paymentCaptureMethod,
  paymentDueAt: invoice.paymentDueAt?.toISOString() || null,
  lineItems: (invoice.lineItems || []).map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount,
    metadata: item.metadata
  })),
  paymentStatus: invoice.paymentStatus || null,
  paidAt: invoice.paidAt?.toISOString() || null,
  paidBy: invoice.paidBy || null,
  voidedAt: invoice.voidedAt?.toISOString() || null,
  voidedBy: invoice.voidedBy || null,
  voidThresholdMinutes: invoice.voidThresholdMinutes || null,
  authorizedAt: invoice.authorizedAt?.toISOString() || null,
  authorizedBy: invoice.authorizedBy || null,
  metadata: invoice.metadata || null,
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString()
};
```

### Void Threshold Enforcement
```typescript
// D-06: Check void threshold before allowing void
if (invoice.voidThresholdMinutes && invoice.paidAt) {
  const minutesSincePaid = (Date.now() - invoice.paidAt.getTime()) / (1000 * 60);
  if (minutesSincePaid > invoice.voidThresholdMinutes) {
    throw new BusinessLogicError(
      `Cannot void invoice: void threshold of ${invoice.voidThresholdMinutes} minutes has passed`,
      'VOID_THRESHOLD_EXCEEDED'
    );
  }
}
```

### Test Fixture Pattern (from existing tests)
```typescript
// Source: services/api-ts/src/handlers/billing/createInvoice.test.ts
const MERCHANT_ID = 'merch-uuid-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cust-uuid-2222-2222-2222-222222222222';

function makeSession(userId = MERCHANT_ID, role = 'user') {
  return {
    user: { id: userId, email: 'test@test.com', name: 'Test User', role },
    session: { id: 'session-id', userId },
  };
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None (Bun auto-discovers *.test.ts) |
| Quick run command | `cd services/api-ts && bun test src/handlers/billing/` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | All fields present in responses | unit | `bun test src/handlers/billing/listInvoices.test.ts -x` | No - Wave 0 |
| BILL-02 | Schema matches TypeSpec | unit (snapshot/assertion) | `bun test src/handlers/billing/schema.test.ts -x` | No - Wave 0 |
| BILL-03 | Admin access enforced | unit | `bun test src/handlers/billing/accessControl.test.ts -x` | No - Wave 0 |
| BILL-04 | Full lifecycle (create->finalize->pay->void) | integration | `bun test src/handlers/billing/lifecycle.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun test src/handlers/billing/`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] `services/api-ts/src/handlers/billing/listInvoices.test.ts` — covers BILL-01 (response fields)
- [ ] `services/api-ts/src/handlers/billing/accessControl.test.ts` — covers BILL-03 (admin guards)
- [ ] `services/api-ts/src/handlers/billing/lifecycle.test.ts` — covers BILL-04 (full lifecycle)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth session (existing middleware) |
| V3 Session Management | yes | Better-Auth (existing) |
| V4 Access Control | yes | Inline admin role check + customer-scoped filtering |
| V5 Input Validation | yes | Zod validators from OpenAPI codegen |
| V6 Cryptography | no | — |

### Known Threat Patterns for Billing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized invoice creation | Elevation of Privilege | Admin-only write + merchant-self check |
| Cross-customer data access | Information Disclosure | Customer-scoped query filter |
| Invoice status manipulation | Tampering | State machine validation (D-04 transitions) |
| Void after threshold bypass | Tampering | voidThresholdMinutes enforcement (D-06) |
| Duplicate invoice creation | Denial of Service | context unique constraint (D-07) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No Drizzle migration needed (all columns exist) | Summary | Would need migration step added to plan |
| A2 | Line items stay in separate table (not JSONB despite D-01) | Pitfall 1 | Would require schema change + data migration |

## Open Questions (RESOLVED)

1. **Line items in list endpoint** — RESOLVED by Plan 01 Task 1
   - What we know: createInvoice returns them, getInvoice should return them
   - What's unclear: Should listInvoices include line items or make it optional (expand param)?
   - Resolution: Include line items in list via batch-fetch (association invoices have 1-3 items, low overhead). No expand param needed.

2. **Admin access model for createInvoice** — RESOLVED by Plan 01 Task 2
   - What we know: D-02 says admin-only for writes. Current createInvoice allows merchant self-service.
   - What's unclear: Should merchants still be able to create their own invoices, or only admins?
   - Resolution: Allow both admin AND merchant-self (current behavior), matching voidInvoice pattern per D-03.

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/handlers/billing/repos/billing.schema.ts` — full schema inspection
- `services/api-ts/src/handlers/billing/*.ts` — all handler files inspected
- `services/api-ts/src/handlers/billing/repos/billing.repo.ts` — repository methods
- `services/api-ts/src/handlers/billing/*.test.ts` — existing test patterns

### Secondary (MEDIUM confidence)
- `.planning/phases/01-billing-schema-completion/01-CONTEXT.md` — user decisions
- `VERTICAL_TDD.md` — testing protocol

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing
- Architecture: HIGH — patterns visible in existing handlers
- Pitfalls: HIGH — identified from actual TODO comments in code

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable — internal code patterns)
