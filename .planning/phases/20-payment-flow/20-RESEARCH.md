# Phase 20: Payment Flow - Research

**Researched:** 2026-05-13
**Domain:** Dues payment recording, receipt generation, optimistic locking on invoice status
**Confidence:** HIGH — all findings verified by codebase inspection

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Officer records payment against an open invoice with: payment method (GCash/bank transfer/cash/check), reference number, amount
- On record: payment status = 'completed', invoice status → 'paid', paidAt timestamped, recordedBy set
- Use existing `recordDuesPayment.ts` handler in `association:member` — implement/fix business logic
- Receipt number: `REC-{orgPrefix}-{timestamp}-{seq}` format (note: existing util uses `{orgCode}-{year}-{NNNNNN}`, planner should prefer the existing format)
- Receipt record IS the payment record — `duesPayments.receiptNumber` column
- Member views own receipts via self-service endpoint
- Officer views receipts for chapter members (org-scoped)
- Optimistic locking: read invoice version → `UPDATE duesInvoices SET status='paid' WHERE id=X AND version=N` → 0 rows affected → throw ConflictError (409)
- No full receipt PDF needed for MVP — payment record with receipt number, amount, date, method

### Claude's Discretion
All remaining implementation details. Follow existing dues handler patterns. Use existing schema (no new tables). Implement optimistic locking via WHERE version=N on invoice update.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | Officer can record offline dues payment (GCash, bank transfer) and mark invoice as paid | `recordDuesPayment.ts` + `markDuesInvoicePaid.ts` exist; `duesPaymentMethodEnum` covers all methods; `requirePosition` guard is implemented |
| PAY-02 | Payment recording generates a receipt viewable by member and officer | `receiptNumber` column + `formatReceiptNumber()` util + `getDuesPayment`/`listDuesPayments` endpoints exist; member self-service via `/my/payments` route + `PaymentHistoryTable` already wired |
| PAY-03 | Concurrent payment recording on same invoice handled safely (no double-payment via optimistic locking) | `markPaid()` in `DuesInvoiceRepository` does NOT use optimistic locking — this is the core gap; `version` field exists on all tables via `baseEntityFields`; `ConflictError` (409) class exists |
</phase_requirements>

## Summary

Phase 20 is mostly **already built** — the backend handlers, schema, utility functions, and frontend pages all exist from prior phases. The work is gap-filling, not greenfield.

**Backend:** `recordDuesPayment.ts` is fully implemented with fund allocation, membership extension, receipt generation, and transaction wrapping. `markDuesInvoicePaid.ts` is implemented with expiry extension but **lacks optimistic locking** — the `markPaid()` repo method does an unconditional `UPDATE` without `WHERE version=N`. Both handlers have extensive test coverage already. The member self-service endpoint is `listDuesPayments` with `personId` filter — the frontend already passes the authenticated user's `personId` via the `PaymentHistoryTable` component at `/my/payments`.

**Frontend:** All officer payment pages exist (`/org/$orgId/officer/payments/`, `/new`, `/$paymentId`). The `RecordPaymentForm` is complete with member search, amount, method, reference number, confirmation dialog. `PaymentHistoryTable` serves both officer (org-scoped) and member (self-service) views. `PaymentDetailPage` shows receipt number, fund allocations, refund form.

**The actual gaps for PAY-01/02/03:**
1. **PAY-03 (critical):** `DuesInvoiceRepository.markPaid()` must add optimistic locking — `WHERE id=X AND version=N`, increment version, throw `ConflictError` if 0 rows affected.
2. **PAY-01 (verify):** `recordDuesPayment.ts` does not call `markDuesInvoicePaid` — when `invoiceId` is provided in the request body, the invoice status must be updated to 'paid' inside the same transaction. Currently only the payment record is created; the invoice status update is a separate call. Need to wire invoice marking inside `recordDuesPayment` when `invoiceId` is provided.
3. **PAY-02 (verify):** Member self-service receipt visibility requires `listDuesPayments` to accept the session user's `personId` when no officer scope is active. Currently `listDuesPayments` uses `personId` from query params (not session), which means a member could query any `personId`. The backend must enforce: non-officer callers can only see their own payments.
4. **Receipt format:** Existing `formatReceiptNumber` uses `{orgCode}-{year}-{NNNNNN}`. The CONTEXT.md says `REC-{orgPrefix}-{timestamp}-{seq}` — these conflict. The existing code and tests use `ORG-YYYY-NNNNNN`. Planner should standardize on the existing format to avoid breaking existing tests.

**Primary recommendation:** Patch `DuesInvoiceRepository.markPaid()` with optimistic locking, wire invoice mark-paid inside `recordDuesPayment` when `invoiceId` is present, add self-service personId enforcement in `listDuesPayments`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Record offline payment | API / Backend | — | Mutation with RBAC, receipt generation, fund allocation, DB transaction |
| Optimistic locking on invoice | API / Backend | — | PostgreSQL-level WHERE clause in UPDATE; client cannot be trusted |
| Receipt number generation | API / Backend | — | Must be atomic + sequential; `getNextReceiptSequence` + `formatReceiptNumber` in backend |
| Officer payment list | API / Backend | Frontend Server | Org-scoped RBAC query + frontend table render |
| Member receipt visibility | API / Backend | Frontend | Backend enforces personId = session.user.id; frontend renders at /my/payments |
| Confirmation dialog (double-record UX guard) | Browser / Client | — | Soft guard only — backend optimistic lock is the real guard |

## Standard Stack

All stack is established — no new libraries needed.

### Core (existing)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | DB queries, optimistic locking WHERE clause | Project standard |
| Hono | existing | HTTP handlers, routing | Project standard |
| Better-Auth | existing | Session, personId extraction | Project standard |
| `@/core/errors` | existing | `ConflictError` (409), `BusinessLogicError` | Project standard |
| `@/utils/officer-check` | existing | `requirePosition` guard | Phase 18 established |
| `formatReceiptNumber` | existing | `{orgCode}-{year}-{NNNNNN}` | In `dues/utils/receipt-number.ts` |
| `settlePayment` | existing | Fund allocation + membership extension | In `dues/utils/settle-payment.ts` |

### Frontend (existing)
| Component | Location | Purpose |
|-----------|----------|---------|
| `RecordPaymentForm` | `features/dues/components/` | Officer payment recording UI |
| `PaymentHistoryTable` | `features/dues/components/` | Dual-mode (org/member) payment list |
| `PaymentDetailPage` | `routes/.../payments/$paymentId.tsx` | Receipt detail + fund allocations |
| `/my/payments` route | `routes/_authenticated/my/payments.tsx` | Member self-service receipt view |

## Architecture Patterns

### System Architecture Diagram

```
Officer POST /association/member/dues-payments
  │
  ├─ requirePosition([Treasurer, President]) → 403 if denied
  ├─ findRecentPaymentForPerson() → concurrentWarning flag
  ├─ getNextReceiptSequence() + formatReceiptNumber()
  └─ db.transaction()
       ├─ createPayment(status='completed', receiptNumber, recordedBy)
       ├─ if body.invoiceId:
       │    markPaidWithOptimisticLock(invoiceId, version) → ConflictError(409) if stale
       └─ settlePayment(tx) → fund allocations + membership expiry extension
       └─ 201 { payment, receiptNumber, fundAllocations, membershipExtended }

Member GET /association/member/dues-payments?personId=<session.user.id>
  │
  └─ listDuesPayments enforces personId == session.user.id if not officer
       └─ DuesRepository.listPayments({ personId }) → paginated payment list

Officer GET /association/member/dues-payments?organizationId=<orgId>
  │
  └─ org-scoped list (existing, already enforces organizationId)
```

### Optimistic Locking Pattern

The `duesInvoices` table has `version integer NOT NULL DEFAULT 1` from `baseEntityFields`. The fix is in `DuesInvoiceRepository.markPaid()`:

```typescript
// VERIFIED: baseEntityFields in core/database.schema.ts has version field
// VERIFIED: ConflictError exists in core/errors.ts with status 409

async markPaidWithOptimisticLock(
  invoiceId: string,
  expectedVersion: number,
  paymentId: string,
  paidAt?: Date
): Promise<DuesInvoice> {
  const [updated] = await this.db
    .update(duesInvoices)
    .set({
      status: 'paid',
      paidAt: paidAt ?? new Date(),
      paymentId,
      version: expectedVersion + 1,  // increment version
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(duesInvoices.id, invoiceId),
        eq(duesInvoices.version, expectedVersion)  // optimistic lock
      )
    )
    .returning();

  if (!updated) {
    throw new ConflictError('Invoice was already paid or modified concurrently');
  }

  return updated as DuesInvoice;
}
```

### Member Self-Service Enforcement Pattern

`listDuesPayments` currently trusts `query.personId`. Fix: if caller is not an officer, override with session personId.

```typescript
// Pattern: extract personId from session, not just query param
const session = ctx.get('session');
const orgId = ctx.get('organizationId');
const callerPersonId = session.user.id;

// Non-officer: can only see own payments
const effectivePersonId = isOfficer ? query.personId : callerPersonId;
```

### Invoice-Payment Linking Pattern

`recordDuesPayment` body already accepts optional `invoiceId`. When present, call `markPaidWithOptimisticLock` inside the same transaction. Caller must pass the invoice's current `version` in the request body.

Request body addition: `invoiceId?: string`, `invoiceVersion?: number` (optional — if not provided, skip invoice marking).

### Receipt Number Format

Existing format (from `formatReceiptNumber` util and tests): `{orgCode}-{year}-{NNNNNN}`

Example: `ORG-2026-000042`

The CONTEXT.md format suggestion (`REC-{orgPrefix}-{timestamp}-{seq}`) conflicts with existing util and tests. **Use the existing format** — changing it would break `receipt-number.test.ts` and `recordDuesPayment.test.ts`.

The `orgCode` is currently hardcoded as `'ORG'` in `recordDuesPayment.ts`. A real org prefix requires fetching from the organization record. For MVP, hardcoded 'ORG' is acceptable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent payment guard | Custom timestamp comparison | Existing `findRecentPaymentForPerson()` + optimistic locking on invoice | Already built, tested |
| Receipt number generation | Custom format + counter | `formatReceiptNumber()` + `getNextReceiptSequence()` | Util exists with tests |
| Fund allocation | Custom percentage math | `settlePayment()` → `membershipLifecycle.settlePayment()` | Handles rounding, last-fund-absorbs-remainder |
| Membership expiry extension | Custom date math | `settlePayment()` internally calls `computeNewExpiry` | Handles lapsed/first-time cases |
| HTTP status for optimistic lock failure | Custom error | `ConflictError` (409) from `@/core/errors` | Standard pattern |
| Officer RBAC | Custom role check | `requirePosition([POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT])` | Phase 18 established |

## Common Pitfalls

### Pitfall 1: Receipt Sequence Race Condition
**What goes wrong:** `getNextReceiptSequence()` uses `COUNT(*) + 1` — two concurrent requests can get the same sequence number before either inserts.
**Why it happens:** Non-atomic read-then-increment outside transaction.
**How to avoid:** The `unique('dues_payment_receipt_unique').on(receiptNumber)` constraint catches duplicates at the DB level (insert will fail). In the rare concurrent case, retry with next sequence or rely on the unique constraint error. For MVP this is acceptable.
**Warning signs:** `duplicate key value violates unique constraint dues_payment_receipt_unique` errors in logs.

### Pitfall 2: `markPaid` Without Optimistic Lock Allows Double-Payment
**What goes wrong:** Two officers open the same invoice simultaneously. Both read `status='generated'`, both call `markPaid`, both succeed — invoice is "paid" twice with two different payment records.
**Why it happens:** Current `markPaid()` does `WHERE id=invoiceId` only — no version check.
**How to avoid:** Implement `markPaidWithOptimisticLock` with `AND version=N`. Second update gets 0 rows affected → `ConflictError`.
**Warning signs:** `duesInvoices.paymentId` updated to a different value than expected; duplicate payment records for same `invoiceId`.

### Pitfall 3: listDuesPayments Personid Trust
**What goes wrong:** Member passes any `personId` in query params and sees another member's payment history.
**Why it happens:** Current `listDuesPayments` uses `query.personId` directly without validating against session.
**How to avoid:** Enforce `personId == session.user.id` unless caller has officer role.

### Pitfall 4: Transaction Scope for Invoice Status Update
**What goes wrong:** Payment record created but invoice mark-paid call fails → payment exists with no corresponding invoice state change.
**Why it happens:** Calling `markPaid` outside the `db.transaction()` in `recordDuesPayment`.
**How to avoid:** Call `markPaidWithOptimisticLock` inside the existing `db.transaction()` block in `recordDuesPayment`.

### Pitfall 5: invoiceVersion Not Validated Before Transaction
**What goes wrong:** Reading invoice version inside the transaction but after concurrent modification — optimistic lock still catches it, but the error happens mid-transaction.
**How to avoid:** Read invoice + validate it's payable (status in ['generated','sent','overdue']) BEFORE opening the transaction (same pattern as `markDuesInvoicePaid`). Then pass the version into the transaction for the locked update.

## Code Examples

### Verified: `duesInvoices` schema has version (via baseEntityFields)
```typescript
// Source: services/api-ts/src/core/database.schema.ts
export const baseEntityFields = {
  ...
  version: integer('version').default(1).notNull(),
  ...
}
// duesInvoices uses ...baseEntityFields → has version column
```

### Verified: ConflictError signature
```typescript
// Source: services/api-ts/src/core/errors.ts
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 'CONFLICT', 409);
  }
}
```

### Verified: requirePosition in recordDuesPayment
```typescript
// Source: services/api-ts/src/handlers/association:member/recordDuesPayment.ts
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;
```

### Verified: Existing test patterns to follow for PAY-03
```typescript
// Source: recordDuesPayment.test.ts - already uses stubRepo pattern
// New tests for PAY-03 should follow same describe/test/stubRepo structure
// Existing describe blocks: [BR-06], [BR-07], transaction atomicity
// New describe block needed: [PAY-03] optimistic locking on invoice
```

## Runtime State Inventory

Not applicable — this is feature implementation, not a rename/refactor phase.

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tools (Bun, PostgreSQL, Drizzle) already available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | none (built-in) |
| Quick run command | `cd services/api-ts && bun test --testPathPattern recordDuesPayment` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | Officer records payment, invoice marked paid | unit | `cd services/api-ts && bun test --testPathPattern recordDuesPayment` | ✅ Wave 0 gap: add invoice-linking test |
| PAY-02 | Receipt viewable by member (personId enforcement) | unit | `cd services/api-ts && bun test --testPathPattern listDuesPayments` | ✅ Exists; add self-service enforcement test |
| PAY-03 | Concurrent recording throws 409 ConflictError | unit | `cd services/api-ts && bun test --testPathPattern markDuesInvoicePaid` | ✅ Exists; add optimistic lock test |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun test --testPathPattern "recordDuesPayment|markDuesInvoicePaid|listDuesPayments"`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `[PAY-03] optimistic locking` describe block to `markDuesInvoicePaid.test.ts` — covers ConflictError on concurrent mark-paid
- [ ] Add invoice-linking test to `recordDuesPayment.test.ts` — covers invoiceId provided in body → invoice status updated inside same transaction
- [ ] Add personId enforcement test to `listDuesPayments.test.ts` (file may not exist yet — create if needed)

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth session — already enforced (`if (!session) throw new UnauthorizedError()`) |
| V3 Session Management | no | Session handled by Better-Auth globally |
| V4 Access Control | yes | `requirePosition([Treasurer, President])` for write; self-service personId == session.user.id for reads |
| V5 Input Validation | yes | Zod validators via generated OpenAPI validators (`RecordDuesPaymentBody`) |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Officer records payment for member in different org | Tampering | `organizationId` from session context, not request body; org-scoped queries |
| Member reads other member's receipts | Info Disclosure | `listDuesPayments` must enforce `personId == session.user.id` for non-officers |
| Double-payment via concurrent requests | Tampering | Optimistic locking: `WHERE version=N` on invoice update → 409 ConflictError |
| Arbitrary invoiceVersion in request | Tampering | Read invoice from DB before transaction; pass actual version to lock — never trust client-supplied version |

**Note on invoiceVersion:** The request body may include `invoiceId` but should NOT include `invoiceVersion` from the client. The backend must read the current invoice version from the DB before the transaction and use that. Client-supplied version would allow bypassing the lock.

## Open Questions

1. **Receipt orgCode prefix**
   - What we know: `recordDuesPayment.ts` hardcodes `'ORG'` as the org code. Existing `formatReceiptNumber` takes `orgCode` param.
   - What's unclear: Should the org prefix be fetched from the organization record (e.g., org `code` or `abbreviation` field)?
   - Recommendation: For MVP, keep `'ORG'` hardcoded. The `receiptNumber` unique constraint prevents collisions regardless. Note in plan as a v1.3.0 improvement.

2. **Invoice version in record-payment flow**
   - What we know: `recordDuesPayment` body has `invoiceId?: string` but no `invoiceVersion`.
   - What's unclear: If the officer's UI doesn't pass `invoiceVersion`, how does the backend get the expected version?
   - Recommendation: Backend reads invoice from DB to get current version before the transaction (fail-fast if already paid). Pass that version to `markPaidWithOptimisticLock`. No client-supplied version needed.

3. **listDuesPayments auth gap — officer vs member detection**
   - What we know: No `isOfficer` flag currently computed in `listDuesPayments`.
   - What's unclear: How to efficiently detect if caller is an officer without a DB call per request.
   - Recommendation: Use `requireOfficerTerm` check or check if `organizationId` is set in context (officers have org context, members may not). Simplest: if `query.personId` is provided and != `session.user.id`, require officer check. If no `personId` filter, default to `session.user.id`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `duesInvoices` has `version` column via `baseEntityFields` | Code Examples | Verified — `dues.schema.ts` uses `...baseEntityFields` which includes `version integer NOT NULL DEFAULT 1` |
| A2 | `recordDuesPayment` does not currently mark the invoice as paid | Summary | Verified by reading the handler — no `markPaid` call exists; only `createPayment` and `settlePayment` |
| A3 | `listDuesPayments` does not enforce personId == session | Summary | Verified — uses `query.personId` directly with no session comparison |

*All claims in this table were verified by codebase inspection in this session — no unresolved assumptions remain.*

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` — full handler implementation
- `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts` — invoice marking handler + test file
- `services/api-ts/src/handlers/association:member/repos/dues.repo.ts` — `DuesInvoiceRepository.markPaid()` (no optimistic lock confirmed)
- `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts` — `duesPayments` table schema
- `services/api-ts/src/handlers/association:member/repos/dues.schema.ts` — `duesInvoices` schema with `baseEntityFields`
- `services/api-ts/src/core/errors.ts` — `ConflictError` (409) class
- `services/api-ts/src/core/database.schema.ts` — `baseEntityFields` includes `version`
- `apps/memberry/src/features/dues/components/record-payment-form.tsx` — frontend form implementation
- `apps/memberry/src/routes/_authenticated/my/payments.tsx` — member self-service route
- `apps/memberry/src/features/dues/components/payment-history-table.tsx` — dual-mode table component

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing, verified by file inspection
- Architecture: HIGH — gaps identified by reading actual handler code
- Pitfalls: HIGH — optimistic lock gap verified line-by-line in `dues.repo.ts`
- Security: HIGH — ASVS V4 gap (listDuesPayments personId bypass) verified

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable codebase, schema unlikely to change)
