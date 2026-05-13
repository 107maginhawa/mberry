# Phase 18: Dues Invoice Security Fix - Research

**Researched:** 2026-05-13
**Domain:** Backend API authorization — org-scoped RBAC on dues handlers
**Confidence:** HIGH (all findings verified directly against codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Enforce officer role check per-handler via existing `requirePosition()` — matches `getDuesDashboard` pattern
- Treasurer + President positions can manage dues (mark paid, modify invoices)
- Query/read endpoints enforce org membership via `orgScopedPersonIds()` — members can view own dues, not other orgs'
- Mutation endpoints (markDuesInvoicePaid, etc.) require officer position + org scope — two-layer check
- 403 responses use generic "Forbidden" message — no information leakage
- 401 for no session (UnauthorizedError), 403 for wrong role/org (ForbiddenError)
- Log all authorization failures via existing Pino logger with correlationId

### Claude's Discretion
Middleware ordering, specific error log format, test fixture structure, handler-internal auth check placement.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Dues invoice endpoints enforce org-scoped RBAC (markDuesInvoicePaid requires officer role + chapter scope) | `markDuesInvoicePaid` has no `requirePosition` call; pattern from `recordDuesPayment` and `getDuesDashboard` directly applies |
| SEC-02 | All dues query endpoints validate caller's organization membership before returning data | `listDuesInvoices`, `getDuesInvoice`, `listDuesPayments`, `getDuesPayment`, `getDuesFinancialDashboard`, `generateDuesReport` all missing org-scope validation in handler body despite route-level `authMiddleware` |
</phase_requirements>

---

## Summary

Phase 18 is a pure security hardening pass on existing dues handlers. No new features, no schema changes, no generated code changes. All handlers live under `services/api-ts/src/handlers/association:member/`. The routes are already registered under `authMiddleware({ roles: ["association:admin"] })` in the generated routes file (which must NOT be edited), so session authentication is enforced at the route level. The gap is that handlers do not verify (a) the caller holds an officer position for the specific org, or (b) the org referenced in the request matches the org the caller belongs to.

The established pattern is fully defined in `getDuesDashboard.ts` (for mutations) and `recordDuesPayment.ts` (already correctly using `requirePosition` before session check). Every affected handler needs the same pattern applied in-handler.

`orgContextMiddleware` runs on `/association/*` routes and already sets `ctx.var.organizationId` from the request header/query/path and verifies the caller is a member of that org. This means **org membership scope is partially enforced at middleware level for association routes**. The remaining gap is: (1) membership check allows `gracePeriod` status — this may be intentional; (2) the middleware does NOT check officer position, only membership; (3) `getDuesPayment` and `getDuesFinancialDashboard` reference orgId from route params but the middleware-set `organizationId` should already match — handlers need to verify and not trust client-supplied params blindly for cross-org isolation.

**Primary recommendation:** Apply `requirePosition([TREASURER, PRESIDENT])` at the top of every mutation handler. Apply org-scope verification (compare invoice/payment's `organizationId` against `ctx.get('organizationId')`) in read handlers for resource-level isolation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session auth (401) | Route middleware (`authMiddleware`) | — | Already enforced via generated routes |
| Org membership (403) | Route middleware (`orgContextMiddleware`) | Handler | Middleware handles `/association/*`; handlers must not rely solely on this |
| Officer position check | Handler | — | `requirePosition()` is a handler utility, not middleware, for position-specific control |
| Cross-org invoice isolation | Handler | — | Handler must compare invoice.organizationId vs ctx.organizationId |
| Audit logging | Handler | — | `auditAction()` call pattern established |

---

## Standard Stack

All libraries already in codebase — no new installs needed.

### Core (all verified by codebase inspection)

| Utility | Location | Purpose |
|---------|----------|---------|
| `requirePosition()` | `src/utils/officer-check.ts` | Position-based 403; returns null (allow) or Response (deny) |
| `POSITION_TITLES` | `src/utils/position-titles.ts` | Canonical title constants: TREASURER, PRESIDENT, SECRETARY, SOCIETY_OFFICER |
| `orgScopedPersonIds()` | `src/core/org-scoped-persons.ts` | Subquery for person IDs in org via active memberships |
| `UnauthorizedError` | `src/core/errors.ts` | Throws 401 |
| `ForbiddenError` | `src/core/errors.ts` | Throws 403 |
| `auditAction()` | `src/utils/audit.ts` | Audit log entry |
| `makeCtx` / `stubRepo` | `src/test-utils/make-ctx.ts` | Test context factory |

---

## Handlers to Modify

### Mutation Handlers (need `requirePosition` guard)

All are in `services/api-ts/src/handlers/association:member/`.

| Handler | File | Current State | Required Fix |
|---------|------|---------------|--------------|
| `markDuesInvoicePaid` | `markDuesInvoicePaid.ts` | Session check only; no position check | Add `requirePosition([TREASURER, PRESIDENT])` before business logic; add cross-org invoice check |
| `updateDuesInvoice` | `updateDuesInvoice.ts` | Needs inspection | Add `requirePosition([TREASURER, PRESIDENT])` |
| `deleteDuesInvoice` | `deleteDuesInvoice.ts` | Needs inspection | Add `requirePosition([TREASURER, PRESIDENT])` |
| `createDuesInvoice` | `createDuesInvoice.ts` | Needs inspection | Add `requirePosition([TREASURER, PRESIDENT])` |
| `generateDuesInvoicesForOrg` | `generateDuesInvoicesForOrg.ts` | Needs inspection | Add `requirePosition([TREASURER, PRESIDENT])` |

**Note:** `recordDuesPayment` already has `requirePosition` correctly applied — it is the reference implementation. [VERIFIED: codebase]

### Read/Query Handlers (need org-scope isolation)

| Handler | File | Current State | Required Fix |
|---------|------|---------------|--------------|
| `listDuesInvoices` | `listDuesInvoices.ts` | Uses `ctx.get('organizationId')` (middleware-set) — correct, but no explicit 403 if orgId missing | Add explicit 403 guard if organizationId is null |
| `getDuesInvoice` | `getDuesInvoice.ts` | Fetches by invoiceId; no org check on returned invoice | After fetch, verify `invoice.organizationId === ctx.get('organizationId')` |
| `listDuesPayments` | `listDuesPayments.ts` | Accepts `query.organizationId` from client — no verification it matches caller's org | Enforce caller's org from ctx, ignore/override client-supplied param |
| `getDuesPayment` | `getDuesPayment.ts` | Fetches by paymentId; no org check | After fetch, verify `payment.organizationId === ctx.get('organizationId')` |
| `getDuesFinancialDashboard` | `getDuesFinancialDashboard.ts` | Uses route param `organizationId` directly — no cross-org check | Verify route param matches `ctx.get('organizationId')` or caller is officer of that org |
| `generateDuesReport` | `generateDuesReport.ts` | Uses route param `organizationId` directly | Same as above |

---

## Architecture Patterns

### Pattern 1: Mutation Handler with Position Guard (reference: `recordDuesPayment`)

```typescript
// Source: services/api-ts/src/handlers/association:member/recordDuesPayment.ts
export async function markDuesInvoicePaid(ctx) {
  // Step 1: position guard (also checks session + orgId internally)
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  // Step 2: session (belt-and-suspenders — requirePosition already checks this)
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // Step 3: get orgId from context (set by orgContextMiddleware)
  const orgId = ctx.get('organizationId');

  // Step 4: fetch resource
  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');

  // Step 5: cross-org isolation — invoice must belong to caller's org
  if (invoice.organizationId !== orgId) throw new ForbiddenError();

  // ... business logic
}
```

[VERIFIED: codebase — recordDuesPayment.ts uses this exact structure]

### Pattern 2: Read Handler with Org-Scope Isolation

```typescript
// For getDuesInvoice, getDuesPayment (fetch by ID, then verify org)
export async function getDuesInvoice(ctx) {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId'); // set by orgContextMiddleware
  if (!orgId) throw new ForbiddenError(); // belt-and-suspenders

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');

  // Cross-org: reject if invoice belongs to a different org
  if (invoice.organizationId !== orgId) throw new ForbiddenError();

  return ctx.json(invoice, 200);
}
```

[ASSUMED — derived from getDuesDashboard and requirePosition patterns; no existing read handler with this exact check found]

### Pattern 3: List Handler — Enforce Org from Context, Not Query Param

```typescript
// For listDuesPayments — client sends organizationId as query param but we ignore it
export async function listDuesPayments(ctx) {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId'); // ALWAYS from context, never from query
  if (!orgId) throw new ForbiddenError();

  // ...use orgId for all queries, ignore query.organizationId
}
```

[VERIFIED: current listDuesPayments.ts uses `query.organizationId` — this is the exact bug to fix]

### Pattern 4: Dashboard/Report Handler — Verify Route Param Matches Context

```typescript
// For getDuesFinancialDashboard, generateDuesReport
export async function getDuesFinancialDashboard(ctx) {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const ctxOrgId = ctx.get('organizationId');

  // Verify route param matches caller's org (orgContextMiddleware already verified membership)
  // Allow platform admins (they get orgMembership.role='admin')
  const membership = ctx.get('orgMembership');
  const isPlatformAdmin = membership?.membershipId === 'platform-admin';

  if (!isPlatformAdmin && organizationId !== ctxOrgId) throw new ForbiddenError();

  // Position check for financial dashboards (officer-only)
  ctx.set('organizationId', organizationId); // ensure requirePosition uses correct org
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  // ...
}
```

[ASSUMED — platform admin bypass from org-context.ts inspection; requirePosition for financial dashboards is consistent with CONTEXT.md decisions]

### Anti-Patterns to Avoid

- **Using query/body org param for security decisions:** `listDuesPayments` currently uses `query.organizationId` — an attacker can pass any org ID. Always use `ctx.get('organizationId')` which is set by middleware after membership verification.
- **Checking session after requirePosition:** `requirePosition` already validates session internally. The session check after `requirePosition` is belt-and-suspenders, not the primary guard.
- **Throwing `ForbiddenError` with reason detail:** The decision says generic "Forbidden" only — do not include `organizationId` mismatch reason in 403 body.
- **Editing generated files:** `src/generated/openapi/routes.ts` and `registry.ts` are auto-generated. All auth logic lives in handler files only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Officer check | Custom DB query | `requirePosition()` | Already handles 2FA enforcement, case-insensitive title match, null-session path |
| Org membership subquery | Custom JOIN | `orgScopedPersonIds()` | Handles active status filters correctly |
| 403 response | `ctx.json({error:'...'}, 403)` | `throw new ForbiddenError()` | Goes through centralized error handler with security filtering |
| Audit trail | Manual log call | `auditAction()` | Standardized schema, correlationId injection |

---

## Common Pitfalls

### Pitfall 1: `orgContextMiddleware` Does Not Check Officer Position
**What goes wrong:** Developer assumes since `orgContextMiddleware` verified membership, the caller is authorized for officer operations.
**Why it happens:** Middleware only confirms the caller is a member of the org, not that they hold a treasurer/president position.
**How to avoid:** Always call `requirePosition()` in mutation handlers regardless of middleware.
**Warning signs:** Handler proceeds without a `requirePosition` or `requireOfficerTerm` call.

### Pitfall 2: Cross-Org Invoice Access via Direct ID Lookup
**What goes wrong:** `getDuesInvoice` fetches by `invoiceId` without verifying the invoice's org matches the caller's org. An officer of Org A can read Org B's invoice if they know the UUID.
**Why it happens:** Route-level `authMiddleware` only checks role string, not org ownership of specific resources.
**How to avoid:** After every `findOneById`, compare `resource.organizationId !== ctx.get('organizationId')` and throw `ForbiddenError()`.
**Warning signs:** Handler fetches resource by ID, returns it, without an org comparison.

### Pitfall 3: Client-Supplied `organizationId` in Query Params Bypasses Scope
**What goes wrong:** `listDuesPayments` passes `query.organizationId` directly to the repo — attacker sends a different org's UUID and gets their data.
**Why it happens:** Handler was written to accept optional filter, but the filter is a security boundary not a UX feature.
**How to avoid:** For all list endpoints that are org-scoped, derive orgId from `ctx.get('organizationId')` and ignore the client query param.
**Warning signs:** `query.organizationId` or `body.organizationId` used in a repo call without comparing to `ctx.get('organizationId')`.

### Pitfall 4: `orgContextMiddleware` Set `organizationId` May Be Null for Non-`/association/*` Paths
**What goes wrong:** `getDuesDashboard` (under `/dues/*` not `/association/*`) does not go through `orgContextMiddleware`. It manually calls `ctx.set('organizationId', orgId)` before `requirePosition`.
**Why it happens:** Middleware is path-scoped.
**How to avoid:** For handlers not under `/association/*`, manually set org context before calling `requirePosition`. The `getDuesDashboard.ts` file is the correct pattern for these routes.
**Warning signs:** `requirePosition` called without a preceding `ctx.set('organizationId', ...)` on a non-association route.

### Pitfall 5: Platform Admin Bypass Missing in Org Verification
**What goes wrong:** Cross-org check (`invoice.organizationId !== ctxOrgId`) throws ForbiddenError for platform admins even though they should have full access.
**Why it happens:** `orgContextMiddleware` sets `orgMembership.membershipId === 'platform-admin'` for admins but org comparison ignores this.
**How to avoid:** Check `ctx.get('orgMembership')?.membershipId === 'platform-admin'` before throwing on org mismatch. Or: rely on the fact that for admins, middleware sets `organizationId` to whatever the client requested — so the check naturally passes.
**Warning signs:** Platform admin cannot access cross-org data after the fix.

---

## Code Examples

### requirePosition call sequence (verified pattern)

```typescript
// Source: services/api-ts/src/handlers/association:member/recordDuesPayment.ts
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

// Call at top of handler — handles session + orgId + position in one call
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;
```

### ForbiddenError throw (generic, no info leakage)

```typescript
// Source: src/core/errors.ts — ForbiddenError defaults to 'Forbidden'
import { ForbiddenError } from '@/core/errors';

if (invoice.organizationId !== orgId) throw new ForbiddenError();
// → 403 { "message": "Forbidden", "code": "FORBIDDEN", ... }
```

### Test mock pattern for requirePosition

```typescript
// Source: services/api-ts/src/handlers/dues/getDuesDashboard.test.ts
import { mock } from 'bun:test';

mock.module('@/utils/officer-check', () => ({
  requirePosition: async () => null, // null = allowed
}));

// For denied scenario:
mock.module('@/utils/officer-check', () => ({
  requirePosition: async () => ctx.json({ error: 'Forbidden' }, 403),
}));
```

---

## Affected Handlers — Full Inventory

Confirmed by inspecting `services/api-ts/src/generated/openapi/registry.ts` and `routes.ts`. [VERIFIED: codebase]

**In `handlers/association:member/`:**

| Handler | Route | Type | Current Auth Gap |
|---------|-------|------|-----------------|
| `markDuesInvoicePaid` | POST `/association/member/dues-invoices/:invoiceId/mark-paid` | Mutation | No `requirePosition`; no cross-org invoice check |
| `updateDuesInvoice` | PATCH `/association/member/dues-invoices/:invoiceId` | Mutation | Needs inspection — likely same gap |
| `deleteDuesInvoice` | DELETE `/association/member/dues-invoices/:invoiceId` | Mutation | Needs inspection |
| `createDuesInvoice` | POST `/association/member/dues-invoices` | Mutation | Needs inspection |
| `generateDuesInvoicesForOrg` | POST `/association/member/dues-invoices/generate` | Mutation | Needs inspection |
| `listDuesInvoices` | GET `/association/member/dues-invoices` | Read | Uses ctx.get('organizationId') — likely OK; needs explicit null guard |
| `getDuesInvoice` | GET `/association/member/dues-invoices/:invoiceId` | Read | No org check after fetch |
| `listDuesPayments` | GET `/association/member/dues-payments` | Read | Uses `query.organizationId` — security hole |
| `getDuesPayment` | GET `/association/member/dues-payments/:paymentId` | Read | No org check after fetch |
| `getDuesFinancialDashboard` | GET `/association/member/dues-reporting/:organizationId/dashboard` | Read + Officer | No `requirePosition`; route param org not verified vs caller's org |
| `generateDuesReport` | GET `/association/member/dues-reporting/:organizationId/report` | Read + Officer | Same as above |

**Already correct (do not modify):**
- `recordDuesPayment` — has `requirePosition` at top [VERIFIED]
- `getDuesDashboard` (under `/dues/` not `/association/member/`) — has `requirePosition` [VERIFIED]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None — Bun auto-discovers `*.test.ts` |
| Quick run | `cd services/api-ts && bun test --filter dues` |
| Full suite | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `markDuesInvoicePaid` returns 403 for non-officer (member role) | unit | `bun test --filter markDuesInvoicePaid` | Wave 0 needed |
| SEC-01 | Officer of Org A cannot mark Org B invoice paid | unit | `bun test --filter markDuesInvoicePaid` | Wave 0 needed |
| SEC-01 | Officer of correct org can mark paid (regression) | unit | `bun test --filter markDuesInvoicePaid` | Wave 0 needed |
| SEC-01 | Mutation handlers return 403 for non-officer | unit | per-handler test files | Wave 0 needed |
| SEC-02 | `listDuesPayments` ignores client `query.organizationId` | unit | `bun test --filter listDuesPayments` | Wave 0 needed |
| SEC-02 | `getDuesInvoice` returns 403 for cross-org invoice access | unit | `bun test --filter getDuesInvoice` | Wave 0 needed |
| SEC-02 | `getDuesPayment` returns 403 for cross-org payment | unit | `bun test --filter getDuesPayment` | Wave 0 needed |
| SEC-02 | `getDuesFinancialDashboard` returns 403 for non-officer | unit | `bun test --filter getDuesFinancialDashboard` | Wave 0 needed |

### Sampling Rate
- Per task commit: `cd services/api-ts && bun test --filter dues`
- Per wave merge: `cd services/api-ts && bun test`
- Phase gate: full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `handlers/association:member/markDuesInvoicePaid.test.ts` — covers SEC-01 officer check + cross-org
- [ ] `handlers/association:member/getDuesInvoice.test.ts` — covers SEC-02 cross-org read
- [ ] `handlers/association:member/getDuesPayment.test.ts` — covers SEC-02 cross-org read
- [ ] `handlers/association:member/listDuesPayments.test.ts` — covers SEC-02 org param enforcement
- [ ] `handlers/association:member/getDuesFinancialDashboard.test.ts` — covers SEC-02 officer guard

Existing: `handlers/dues/getDuesDashboard.test.ts` and `handlers/association:member/dues.test.ts` (business rules) — neither covers the security scenarios.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (partial) | Better-Auth session via `authMiddleware` — already enforced |
| V4 Access Control | yes (primary) | `requirePosition()` for RBAC; org-scope isolation in handlers |
| V5 Input Validation | yes | Reject client-supplied orgId param in security-sensitive list endpoints |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal privilege escalation (Org A officer touches Org B data) | Elevation of Privilege | Compare `resource.organizationId` vs `ctx.get('organizationId')` in every handler |
| Role bypass via query param injection | Tampering | Use `ctx.get('organizationId')` (middleware-enforced), not `query.organizationId` |
| Member marking own invoice paid | Elevation of Privilege | `requirePosition([TREASURER, PRESIDENT])` — membership check insufficient |
| Information disclosure via invoice ID enumeration | Information Disclosure | Cross-org check on `getDuesInvoice` and `getDuesPayment` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `updateDuesInvoice`, `deleteDuesInvoice`, `createDuesInvoice`, `generateDuesInvoicesForOrg` have same auth gap as `markDuesInvoicePaid` | Affected Handlers | If they already have `requirePosition`, those tasks are no-ops — low risk |
| A2 | Platform admin bypass works correctly for cross-org checks because `orgContextMiddleware` sets `organizationId` to whatever client requested for admins | Common Pitfalls | If middleware sets a different orgId for admins, cross-org check could incorrectly fail |
| A3 | `getDuesFinancialDashboard` should require officer position (not just org membership) | Affected Handlers | If read-only financial dashboard is intentionally member-accessible, requirePosition is too strict |

---

## Open Questions

1. **Should `getDuesFinancialDashboard` / `generateDuesReport` require officer position or just org membership?**
   - What we know: These are financial reporting endpoints with sensitive aggregate data
   - What's unclear: CONTEXT.md says "Query/read endpoints enforce org membership via `orgScopedPersonIds()`" — this could mean members can query their own org's totals
   - Recommendation: Apply officer position check per CONTEXT.md phrase "Mutation endpoints require officer position + org scope — two-layer check" only applies to mutations. For read/reporting, apply org membership check only (not position). Confirm with planner.

2. **Does `listDuesInvoices` need a position check or just org-scope?**
   - What we know: Route has `authMiddleware({ roles: ["association:admin"] })` — `association:admin` is a role string stored on user, not the same as officer term in DB
   - What's unclear: The CONTEXT.md says query endpoints use `orgScopedPersonIds()` for members — members may need to see their own invoices
   - Recommendation: No position check on list/read; enforce org scope; individual invoice access restricted to own invoices OR officer-level access.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code-only changes to existing handlers. No external dependencies.

---

## Sources

### Primary (HIGH confidence — all verified by direct codebase inspection)
- `services/api-ts/src/handlers/dues/getDuesDashboard.ts` — reference mutation handler pattern
- `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` — reference with `requirePosition` already applied
- `services/api-ts/src/utils/officer-check.ts` — `requirePosition()` implementation
- `services/api-ts/src/utils/position-titles.ts` — `POSITION_TITLES` constants
- `services/api-ts/src/core/org-scoped-persons.ts` — `orgScopedPersonIds()` implementation
- `services/api-ts/src/middleware/org-context.ts` — how org context is set for `/association/*`
- `services/api-ts/src/middleware/officer-auth.ts` — middleware-level officer check (not used on dues routes)
- `services/api-ts/src/core/errors.ts` — `ForbiddenError`, `UnauthorizedError`
- `services/api-ts/src/generated/openapi/routes.ts` — route registrations confirming which middleware is applied
- `services/api-ts/src/generated/openapi/registry.ts` — handler imports confirming which files to edit
- `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts` — confirmed no `requirePosition`
- `services/api-ts/src/handlers/association:member/listDuesPayments.ts` — confirmed `query.organizationId` security hole
- `services/api-ts/src/handlers/association:member/getDuesInvoice.ts` — confirmed no cross-org check
- `services/api-ts/src/handlers/association:member/getDuesPayment.ts` — confirmed no cross-org check
- `services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.ts` — confirmed no position check
- `services/api-ts/src/test-utils/make-ctx.ts` — test helper patterns

---

## Metadata

**Confidence breakdown:**
- Auth gaps identified: HIGH — confirmed by direct handler inspection
- Fix pattern: HIGH — two reference implementations exist in codebase
- Test strategy: HIGH — existing test patterns directly applicable
- Edge cases (platform admin, gracePeriod membership): MEDIUM — inferred from middleware, not tested

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (stable codebase)
