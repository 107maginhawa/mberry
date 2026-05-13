---
phase: 18-dues-invoice-security-fix
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - services/api-ts/src/handlers/association:member/createDuesInvoice.ts
  - services/api-ts/src/handlers/association:member/deleteDuesInvoice.ts
  - services/api-ts/src/handlers/association:member/dues-mutation-auth.test.ts
  - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
  - services/api-ts/src/handlers/association:member/generateDuesReport.ts
  - services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.test.ts
  - services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.ts
  - services/api-ts/src/handlers/association:member/getDuesInvoice.test.ts
  - services/api-ts/src/handlers/association:member/getDuesInvoice.ts
  - services/api-ts/src/handlers/association:member/getDuesPayment.test.ts
  - services/api-ts/src/handlers/association:member/getDuesPayment.ts
  - services/api-ts/src/handlers/association:member/listDuesInvoices.ts
  - services/api-ts/src/handlers/association:member/listDuesPayments.test.ts
  - services/api-ts/src/handlers/association:member/listDuesPayments.ts
  - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.test.ts
  - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts
  - services/api-ts/src/handlers/association:member/updateDuesInvoice.ts
findings:
  critical: 4
  warning: 4
  info: 2
  total: 10
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase adds position-based RBAC and cross-org isolation to dues invoice mutation handlers. The core security fixes (requirePosition, cross-org checks) are present in all mutation handlers. However, several correctness and security defects remain.

The most critical issues: (1) `markDuesInvoicePaid` checks auth AFTER calling `requirePosition`, creating a window where an unauthenticated request can reach position checks that read the DB; (2) `generateDuesReport` and `getDuesFinancialDashboard` mutate context state (`ctx.set('organizationId', ...)`) after the cross-org check — a pattern that can produce incorrect auth behavior; (3) `createDuesInvoice` accepts a caller-supplied `personId` without validating that it belongs to the requesting org, enabling one treasurer to create invoices attributing them to members of another org; (4) `generateDuesInvoicesForOrg` generates invoices inside a per-member loop without a wrapping transaction — partial failures leave orphaned invoices.

---

## Critical Issues

### CR-01: Session check after requirePosition in `markDuesInvoicePaid`

**File:** `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts:23-27`

**Issue:** `requirePosition` is called at line 23, before the session null-check at line 27. `requirePosition` internally reads the session/position from the DB. If it throws (or panics) on a missing session rather than returning a 401, an unauthenticated caller can exercise the position-check code path. All other handlers in this module correctly place the session guard first. This is an inconsistency that makes the authentication order non-uniform and potentially exploitable if `requirePosition` ever changes behavior on null sessions.

**Fix:**
```typescript
export async function markDuesInvoicePaid(...) {
  // GUARD ORDER: session first, then position
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;
  // ...
}
```

---

### CR-02: Unscoped `personId` input in `createDuesInvoice` — cross-person IDOR

**File:** `services/api-ts/src/handlers/association:member/createDuesInvoice.ts:38`

**Issue:** The handler accepts `body.personId` from the request and uses it without validating that the referenced person is actually a member of the caller's org:

```typescript
personId: body.personId || session.user.id,
```

A treasurer of Org A can POST `{"personId": "<person-in-org-B>", ...}` and create an invoice attributed to a person in another organization. The `organizationId` will be correctly scoped (Org A), but `personId` is entirely attacker-controlled. This creates data integrity corruption and potential billing fraud.

**Fix:** After creating the repo, validate that `body.personId` (when provided) belongs to the same org before inserting:

```typescript
if (body.personId && body.personId !== session.user.id) {
  const membership = await repo.findMembershipByPersonAndOrg(body.personId, orgId);
  if (!membership) throw new ForbiddenError();
}
const personId = body.personId || session.user.id;
```

---

### CR-03: `generateDuesInvoicesForOrg` has no transaction — partial failure leaves orphaned invoices

**File:** `services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts:84-126`

**Issue:** Each invoice is inserted in a separate `db.insert()` call (line 107) without any wrapping transaction. If the server crashes, a network error occurs, or one insert fails mid-loop, the function leaves a partial set of invoices committed. On retry, the idempotency check (`existing` at line 86) prevents duplicate creation — but only for the specific `membershipId + periodStart + periodEnd` combination. Any invoices created before the failure are permanently committed but the batch is incomplete, and the caller receives an error with no rollback.

**Fix:** Wrap the entire insert loop in a single transaction:

```typescript
const generatedInvoices = await db.transaction(async (tx) => {
  const results: any[] = [];
  for (const member of activeMembers) {
    const [existing] = await tx.select()...;
    if (existing) continue;
    const [invoice] = await tx.insert(duesInvoices).values({...}).returning();
    results.push(invoice);
  }
  return results;
});
```

---

### CR-04: `ctx.set('organizationId', ...)` after cross-org check bypasses auth consistency

**File:** `services/api-ts/src/handlers/association:member/generateDuesReport.ts:25` and `getDuesFinancialDashboard.ts:25`

**Issue:** Both handlers follow this sequence:
1. Read `organizationId` from the route param.
2. Cross-org check: `if (ctxOrgId && organizationId !== ctxOrgId) throw ForbiddenError`.
3. **`ctx.set('organizationId', organizationId)` — mutate context to the route param value.**
4. Call `requirePosition(ctx, ...)` — which reads `organizationId` from context.

The guard at step 2 is conditional: it only fires when `ctxOrgId` is truthy. If middleware fails to set `organizationId` in context (e.g., anonymous route, middleware bug), `ctxOrgId` is null/undefined, the check is silently skipped, and then `ctx.set` writes the attacker-supplied route param into context. `requirePosition` then checks positions against the attacker-controlled org, not the JWT-bound org. The correct pattern is to use the JWT org exclusively and never trust route params for org scoping.

**Fix:** Remove `ctx.set(...)` entirely. Use the ctx org exclusively. If the route param is needed for the query, verify it equals ctxOrgId with a hard (non-conditional) check:

```typescript
const { organizationId } = ctx.req.valid('param');
const ctxOrgId = ctx.get('organizationId');
if (!ctxOrgId) throw new ForbiddenError();
if (organizationId !== ctxOrgId) throw new ForbiddenError();
// Do NOT ctx.set — use ctxOrgId everywhere below
const denied = await requirePosition(ctx, [...]);
```

---

## Warnings

### WR-01: `invoiceNumber` collision risk in `createDuesInvoice`

**File:** `services/api-ts/src/handlers/association:member/createDuesInvoice.ts:33`

**Issue:** Invoice numbers are generated as `INV-${Date.now()}`. Under concurrent requests (two treasurers firing simultaneously, or two requests within the same millisecond), this produces duplicate invoice numbers. If `invoiceNumber` has a unique DB constraint, one request will fail with a cryptic DB error instead of a proper 409. If no unique constraint exists, duplicate invoice numbers are silently created, breaking financial record integrity.

**Fix:** Use a sequence or crypto-random suffix:

```typescript
const invoiceNumber = `INV-${orgId.slice(0, 8)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
```

Or, for true uniqueness, generate from a DB sequence. Note: `generateDuesInvoicesForOrg` already uses a counter suffix (`-${invoiceCounter}`) which partially mitigates this within a single batch call, but `createDuesInvoice` does not.

---

### WR-02: `listDuesPayments` pagination fields may conflict and produce wrong offsets

**File:** `services/api-ts/src/handlers/association:member/listDuesPayments.ts:25-28`

**Issue:** The handler accepts both `page`/`pageSize` and `offset`/`limit` query params, computing:

```typescript
const page = query.page ?? 1;
const pageSize = query.pageSize ?? 20;
const offset = query.offset ?? (page - 1) * pageSize;
const limit = query.limit ?? pageSize;
```

A caller who sends `page=3&offset=0` gets `offset=0` (query.offset wins), skipping the page-based offset entirely. A caller who sends `page=3&limit=50` gets `limit=50` but `offset=40` (from page*pageSize where pageSize=20 default). These combinations are silently resolved in contradictory ways. The behavior is unpredictable for API consumers who mix the two pagination styles.

**Fix:** Pick one pagination style. If both are accepted, enforce mutual exclusivity and return a 400 if both are provided.

---

### WR-03: `generateDuesReport` returns untyped `data: any` without null guard

**File:** `services/api-ts/src/handlers/association:member/generateDuesReport.ts:36-61`

**Issue:** `data` is declared `let data: any` and is never assigned if `type` doesn't match any `case` (i.e., an unknown `type` value reaches the `switch` without a `default`). In that case, `data` is `undefined`, and the response `ctx.json({ data, summary, meta })` serializes `data` as `undefined` which JSON.stringify drops the key entirely — producing a malformed response object with no `data` field. The TypeSpec-generated validator may prevent unknown `type` values at the route layer, but there is no `default` branch as a defensive backstop.

**Fix:** Add a `default` case:

```typescript
default:
  throw new Error(`Unknown report type: ${type}`);
```

---

### WR-04: `markDuesInvoicePaid` accepts `body.paymentId` but passes it unvalidated to `markPaid`

**File:** `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts:51`

**Issue:** `body.paymentId` is a caller-supplied string passed directly to `txInvoiceRepo.markPaid(invoiceId, body.paymentId, ...)`. There is no check that the referenced payment exists, belongs to this org, or is in a state that corresponds to paying this invoice. A treasurer could supply any arbitrary payment ID string (or a payment ID from another org) and mark an invoice paid against it. This creates audit trail integrity issues and potentially links invoices to payments from other organizations.

**Fix:** If `paymentId` is provided, verify it exists in the same org before marking paid:

```typescript
if (body.paymentId) {
  const payment = await repo.getPayment(body.paymentId);
  if (!payment || payment.organizationId !== orgId) {
    throw new ForbiddenError();
  }
}
```

---

## Info

### IN-01: TODO comment in `getDuesFinancialDashboard` — `expiringThisMonth` hardcoded to 0

**File:** `services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.ts:47`

**Issue:**
```typescript
expiringThisMonth: 0, // TODO: implement with membership expiry query in Slice 3
```

The dashboard returns a permanent `0` for expiring members. If this field is visible in the admin UI it will always show 0, potentially causing officers to miss renewal urgency. The TODO is not tracked in any test.

**Fix:** Implement the expiry query or remove the field from the response shape until it is implemented.

---

### IN-02: `generateDuesInvoicesForOrg` audit is logged before invoices are created

**File:** `services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts:39-44`

**Issue:** `auditAction` is called at line 39, before the invoice generation loop (line 84). If the generation fails partway through, the audit log already records a successful "Bulk dues invoice generation triggered" event, which is misleading for compliance purposes.

**Fix:** Move the `auditAction` call to after the generation loop completes, including the count of invoices generated:

```typescript
await auditAction(ctx, {
  action: 'create',
  resourceType: 'dues-invoice',
  resourceId: orgId,
  description: `Bulk dues invoice generation: ${count} invoices created`,
});
```

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
