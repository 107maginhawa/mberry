---
phase: 01-billing-schema-completion
reviewed: 2026-05-06T12:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - services/api-ts/src/handlers/billing/listInvoices.ts
  - services/api-ts/src/handlers/billing/getInvoice.ts
  - services/api-ts/src/handlers/billing/finalizeInvoice.ts
  - services/api-ts/src/handlers/billing/createInvoice.ts
  - services/api-ts/src/handlers/billing/updateInvoice.ts
  - services/api-ts/src/handlers/billing/deleteInvoice.ts
  - services/api-ts/src/handlers/billing/voidInvoice.ts
  - services/api-ts/src/handlers/billing/repos/billing.repo.ts
  - services/api-ts/src/handlers/billing/repos/billing.schema.ts
  - services/api-ts/src/handlers/billing/lifecycle.test.ts
  - services/api-ts/src/handlers/billing/accessControl.test.ts
  - services/api-ts/src/handlers/billing/listInvoices.test.ts
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-06T12:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Billing module handlers implement CRUD + lifecycle state transitions (draft -> open -> paid/void). The implementation has solid access control patterns and test coverage for the happy path. However, there are race conditions in invoice number generation, missing line-item persistence on update, a void handler that never sets `voidedBy`, and an authorization bypass in `listInvoices`. Security-wise, the void handler leaks internal Stripe metadata to clients.

## Critical Issues

### CR-01: Race condition in generateInvoiceNumber (no locking)

**File:** `services/api-ts/src/handlers/billing/repos/billing.repo.ts:171-191`
**Issue:** `generateInvoiceNumber()` reads the max invoice number and increments it without any database lock or unique constraint retry. Under concurrent requests, two invoices can receive the same number. Although a unique constraint exists on `invoice_number`, the transaction in `createWithLineItems` calls `generateInvoiceNumber()` BEFORE entering the transaction's insert (it uses `this.generateInvoiceNumber()` which queries outside the `tx` context -- it uses `this.db` not `tx`). Two concurrent calls will both read the same max and both attempt the same number; one will get a raw DB constraint violation (unhandled 500) instead of a retry.
**Fix:**
```typescript
async createWithLineItems(
  invoiceData: Omit<NewInvoice, 'id' | 'invoiceNumber'>,
  lineItemsData: Omit<NewInvoiceLineItem, 'id' | 'invoice'>[]
): Promise<InvoiceWithLineItems> {
  return await this.db.transaction(async (tx) => {
    // Lock the invoices table row with highest number using FOR UPDATE
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const result = await tx
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(like(invoices.invoiceNumber, `${prefix}%`))
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1)
      .for('update');
    
    let nextNumber = 1;
    if (result.length > 0 && result[0]) {
      nextNumber = parseInt(result[0].invoiceNumber.replace(prefix, '')) + 1;
    }
    const invoiceNumber = `${prefix}${nextNumber.toString().padStart(6, '0')}`;

    // ... rest inside tx
  });
}
```

### CR-02: updateInvoice recalculates totals but never persists new line items

**File:** `services/api-ts/src/handlers/billing/updateInvoice.ts:105-132`
**Issue:** When `body.lineItems` is provided, the handler calculates new subtotal/total and updates the invoice record, but never deletes old line items or inserts new ones. The `processedLineItems` variable is computed but never written to the database. The response fetches `findOneWithLineItems` which returns the OLD line items, creating a mismatch between displayed totals and actual line item data.
**Fix:**
```typescript
// After computing processedLineItems, inside the lineItems block:
// Delete old line items and insert new ones (within a transaction)
await invoiceRepo.db.transaction(async (tx) => {
  // Delete existing line items
  await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoice, invoiceId));
  // Insert new line items
  await tx.insert(invoiceLineItems).values(
    processedLineItems.map(item => ({ ...item, invoice: invoiceId }))
  );
});
```

### CR-03: voidInvoice never sets voidedBy field

**File:** `services/api-ts/src/handlers/billing/voidInvoice.ts:151-156`
**Issue:** The `updateOneById` call sets `voidedAt` and `status: 'void'` but does not set `voidedBy: user.id`. The audit trail for who voided the invoice is permanently lost. The `updateStatus` helper in the repo does set `voidedAt` but also doesn't set `voidedBy`.
**Fix:**
```typescript
await invoiceRepo.updateOneById(invoiceId, {
  paymentStatus: 'canceled',
  status: 'void',
  voidedAt: new Date(),
  voidedBy: user.id,  // Add this
  metadata: updatedMetadata,
});
```

## Warnings

### WR-01: listInvoices authorization bypass when merchant filter is self

**File:** `services/api-ts/src/handlers/billing/listInvoices.ts:75-76`
**Issue:** The access control check at line 75 is: `if (filters.customer && filters.customer !== user.id && filters.merchant !== user.id)`. This means if a non-admin user passes `?customer=victimId&merchant=theirOwnId`, the check passes (because `filters.merchant === user.id`), but the `buildWhereConditions` applies BOTH filters with AND -- returning invoices where the victim is customer AND the attacker is merchant. This is actually safe by accident (they'd only see their own invoices as merchant). However, if only `?merchant=someoneElseId` is passed without a `customer` filter, no authorization check triggers at all because the first condition `filters.customer` is falsy. A non-admin can view all invoices for any merchant.
**Fix:**
```typescript
if (!isAdmin) {
  if (filters.merchant && filters.merchant !== user.id) {
    throw new ForbiddenError('You can only view your own invoices');
  }
  if (filters.customer && filters.customer !== user.id) {
    throw new ForbiddenError('You can only view your own invoices');
  }
  if (!filters.customer && !filters.merchant) {
    filters.customerOrMerchant = user.id;
  }
}
```

### WR-02: voidInvoice leaks internal Stripe metadata to client

**File:** `services/api-ts/src/handlers/billing/voidInvoice.ts:178-181`
**Issue:** The `safeMetadata` object exposes `stripePaymentIntentId` directly to the client response. While labeled "safe", Stripe payment intent IDs are internal identifiers that could be used for social engineering or in combination with other leaked data to manipulate payment state via Stripe API calls if the attacker also obtained an API key.
**Fix:** Remove `stripePaymentIntentId` from client-facing response, or only include it for admin users.

### WR-03: voidInvoice swallows NotFoundError and ForbiddenError in catch block

**File:** `services/api-ts/src/handlers/billing/voidInvoice.ts:219-230`
**Issue:** The catch block only re-throws `ValidationError`, `ConflictError`, and `BusinessLogicError`. If a `NotFoundError` or `ForbiddenError` is thrown within the try block (lines 169-173), it would be caught and converted to a generic `BusinessLogicError('Failed to void invoice')`, hiding the actual error from the client and returning incorrect status codes.
**Fix:**
```typescript
} catch (error) {
  if (error instanceof ValidationError || error instanceof ConflictError || 
      error instanceof BusinessLogicError || error instanceof NotFoundError ||
      error instanceof ForbiddenError) {
    throw error;
  }
  throw new BusinessLogicError(
    'Failed to void invoice. Please try again later.',
    'INVOICE_VOID_ERROR'
  );
}
```

### WR-04: finalizeInvoice rejects zero-total invoices incorrectly

**File:** `services/api-ts/src/handlers/billing/finalizeInvoice.ts:73`
**Issue:** The check `!invoice.total || invoice.total <= 0` uses falsy check which rejects `total === 0`. Zero-total invoices are legitimate (e.g., comp invoices, credit-covered invoices). The `!invoice.total` is redundant with `<= 0` anyway since 0 is falsy.
**Fix:**
```typescript
if (invoice.total < 0) {
  throw new BusinessLogicError(
    'Cannot finalize invoice: invoice must not have a negative total',
    'INCOMPLETE_INVOICE_DATA'
  );
}
```

### WR-05: updateStatus in repo sets paidAt/voidedAt but not paidBy/voidedBy

**File:** `services/api-ts/src/handlers/billing/repos/billing.repo.ts:128-148`
**Issue:** The `updateStatus` method accepts `userId` and sets `updatedBy`, but when status is `'paid'` it only sets `paidAt` (not `paidBy`), and when status is `'void'` it only sets `voidedAt` (not `voidedBy`). This creates incomplete audit records. The `userId` parameter exists but is underutilized.
**Fix:**
```typescript
if (status === 'paid' && !updateData.paidAt) {
  updateData.paidAt = new Date();
  if (userId) updateData.paidBy = userId;
} else if (status === 'void' && !updateData.voidedAt) {
  updateData.voidedAt = new Date();
  if (userId) updateData.voidedBy = userId;
}
```

## Info

### IN-01: Pervasive use of `as any` type assertions

**File:** `services/api-ts/src/handlers/billing/updateInvoice.ts:38-39`
**Issue:** Multiple handlers cast params and body to `any` (`ctx.req.valid('param') as any`, `ctx.req.valid('json') as any`), defeating TypeScript's type safety. The generated validator types exist but are unused.
**Fix:** Use the imported validator types directly: `const params = ctx.req.valid('param') as UpdateInvoiceParams;`

### IN-02: Unused import in voidInvoice

**File:** `services/api-ts/src/handlers/billing/voidInvoice.ts:4`
**Issue:** `ValidationError` is imported but never thrown in this handler.
**Fix:** Remove unused import.

---

_Reviewed: 2026-05-06T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
