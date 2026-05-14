# Phase 23: Member Departure + Deceased - Research

**Researched:** 2026-05-13
**Domain:** Membership lifecycle — status enum extension, departure handler, billing/notification guards
**Confidence:** HIGH

## Summary

Phase 23 adds two dedicated departure pathways (resignation and death) to the existing membership lifecycle. The core change is extending `membershipStatusEnum` with four new values (`resigned`, `deceased`, `expelled`, `lapsed` — though `lapsed` already exists), adding a `dateOfDeath` field to person or membership, and creating two new handler endpoints that record the departure with proper metadata.

The billing guard lives in `generateDuesInvoicesForOrg.ts` — currently it only queries `status = 'active'`, so departed statuses are already implicitly excluded if we add them to the enum. The open-invoice void step requires a targeted update in the same transaction. The notification guard lives in `reminderProcessor.ts`, which already filters on `inArray(memberships.status, ['active', 'gracePeriod'])` — departed statuses are again implicitly excluded.

**Primary recommendation:** Extend `membershipStatusEnum`, add `dateOfDeath` to the membership schema (not person — no person schema field exists for it), add two new TypeSpec operations (`resignMembership`, `deceaseMembership`), implement handlers that mirror `terminateMembership.ts`, update `generateDuesInvoicesForOrg` to also void open invoices for the member, and add an `inArray` guard to bulk notification sends.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extend membership status enum to include: `resigned`, `deceased`, `expelled`, `lapsed` (not boolean)
- Add `terminationReason` varchar field for context — already exists on schema
- Add `dateOfDeath` date field on person record (already may exist via Better-Auth)
- Add `terminatedAt` timestamp — already exists on schema
- Officer marks member as resigned: sets membership status to `resigned`, records reason and date
- Officer marks member as deceased: sets membership status to `deceased`, records date of death
- Both actions are irreversible (soft — admin can override but normal officers cannot undo)
- Require officer position (Treasurer, President, or Secretary)
- Dues invoice generation skips members with status `resigned`, `deceased`, `expelled`, or `lapsed`
- Existing open invoices for departed members are voided/cancelled
- Bulk notification sends skip members with departed/deceased status
- Email queue processor checks membership status before sending

### Claude's Discretion
All remaining implementation details at Claude's discretion. Follow existing membership handler patterns.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIF-01 | Officer can mark member as resigned with termination reason code | New `resignMembership` handler + TypeSpec op |
| LIF-02 | Officer can mark member as deceased with date | New `deceaseMembership` handler + TypeSpec op |
| LIF-03 | Departed/deceased members automatically excluded from dues billing and notifications | Guard in `generateDuesInvoicesForOrg` + `reminderProcessor` |
| LIF-04 | Membership termination uses status enum (not boolean) supporting resigned, deceased, expelled, lapsed | Schema enum extension + migration |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status enum extension | Database / Storage | API / Backend | Drizzle pgEnum + migration |
| Resignation handler | API / Backend | — | Handler + repo update |
| Deceased handler | API / Backend | — | Handler + repo update |
| Billing exclusion guard | API / Backend | — | WHERE clause in generateDuesInvoicesForOrg |
| Open-invoice void | API / Backend | — | Bulk UPDATE inside departure transaction |
| Notification exclusion | API / Backend | — | inArray guard in reminderProcessor |
| TypeSpec definition | API / Backend | — | Spec-first requirement; two new operations |

## Standard Stack

### Core (existing — no new installs needed)
| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| Drizzle ORM | current | Schema + queries | [VERIFIED: codebase] |
| Hono | current | Route handler context | [VERIFIED: codebase] |
| TypeSpec | current | Spec-first API definition | [VERIFIED: codebase] |
| Bun test | current | Unit test framework | [VERIFIED: package.json] |

**Installation:** No new packages required.

## Architecture Patterns

### System Architecture Diagram

```
Officer HTTP POST /association/member/memberships/{id}/resign
    → requirePosition([Treasurer, President, Secretary])
    → resignMembership handler
        → MembershipRepository.findOneById(id)
        → validate: status not already departed/deceased/terminated
        → db.transaction:
            → memberships UPDATE status='resigned', terminatedAt=now, terminationReason
            → duesInvoices UPDATE status='cancelled' WHERE membershipId=id AND status NOT IN ('paid','cancelled','writtenOff')
        → auditAction(ctx, 'resign', 'membership', id)
        → return 200 updated membership

Officer HTTP POST /association/member/memberships/{id}/deceased
    → requirePosition([Treasurer, President, Secretary])
    → deceaseMembership handler
        → MembershipRepository.findOneById(id)
        → validate: status not already deceased/terminated
        → db.transaction:
            → memberships UPDATE status='deceased', terminatedAt=now, dateOfDeath, terminationReason
            → duesInvoices UPDATE status='cancelled' WHERE membershipId=id AND status NOT IN ('paid','cancelled','writtenOff')
        → auditAction(ctx, 'deceased', 'membership', id)
        → return 200 updated membership

Background: generateDuesInvoicesForOrg
    → currently: WHERE status = 'active'
    → no change needed (resigned/deceased not active)
    → add: open-invoice void for departed member if called again (idempotent)

Background: processDuesReminders
    → already: inArray(status, ['active', 'gracePeriod'])
    → no change needed — departed statuses are implicitly excluded
    → but: add explicit guard comment for auditability (EML-03 prep)
```

### Recommended Project Structure
```
services/api-ts/src/handlers/association:member/
├── resignMembership.ts          # NEW: LIF-01
├── resignMembership.test.ts     # NEW: unit tests
├── deceaseMembership.ts         # NEW: LIF-02
├── deceaseMembership.test.ts    # NEW: unit tests
└── repos/membership.schema.ts   # MODIFY: enum extension + dateOfDeath field

specs/api/src/association/member/membership.tsp  # MODIFY: enum + 2 new operations

services/api-ts/src/generated/migrations/        # AUTO-GENERATED: enum migration
```

### Pattern 1: New Departure Handler (mirrors terminateMembership.ts)

```typescript
// Source: services/api-ts/src/handlers/association:member/terminateMembership.ts
// Pattern: requirePosition guard → findOneById → validate → updateOneById + voidInvoices → audit

export async function resignMembership(
  ctx: ValidatedContext<ResignMembershipBody, never, ResignMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const denied = await requirePosition(ctx, [
    POSITION_TITLES.PRESIDENT,
    POSITION_TITLES.TREASURER,
    POSITION_TITLES.SECRETARY,
  ]);
  if (denied) return denied;

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  const TERMINAL_STATUSES = ['resigned', 'deceased', 'expelled', 'terminated'];
  if (TERMINAL_STATUSES.includes(membership.status)) {
    throw new BusinessLogicError(
      'Membership is already in a terminal state.',
      'ALREADY_TERMINAL',
    );
  }

  await db.transaction(async (tx) => {
    await tx.update(memberships)
      .set({
        status: 'resigned',
        terminatedAt: new Date(),
        terminationReason: body.terminationReason ?? null,
      })
      .where(eq(memberships.id, membershipId));

    // Void open invoices
    await tx.update(duesInvoices)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(duesInvoices.membershipId, membershipId),
          notInArray(duesInvoices.status, ['paid', 'cancelled', 'writtenOff']),
        ),
      );
  });

  await auditAction(ctx, {
    action: 'resign',
    resourceType: 'membership',
    resourceId: membershipId,
    description: `Member resigned. Reason: ${body.terminationReason ?? 'unspecified'}`,
  });

  const updated = await repo.findOneById(membershipId);
  return ctx.json(updated, 200);
}
```

### Pattern 2: Schema Enum Extension

```typescript
// Source: services/api-ts/src/handlers/association:member/repos/membership.schema.ts
// MODIFY existing membershipStatusEnum — add resigned, deceased, expelled

export const membershipStatusEnum = pgEnum('membership_status', [
  'pendingPayment',
  'active',
  'gracePeriod',
  'lapsed',
  'expired',
  'suspended',
  'terminated',
  'resigned',    // NEW: LIF-04
  'deceased',    // NEW: LIF-04
  'expelled',    // NEW: LIF-04
]);
```

PostgreSQL `ALTER TYPE ... ADD VALUE` is safe and does NOT require recreating the enum. Drizzle generates the correct migration automatically.

### Pattern 3: dateOfDeath Field

The person schema does NOT have a `dateOfDeath` field [VERIFIED: grep returned empty]. Add it to the `memberships` table (not `persons`) since it is org-scoped — a person can be active in one chapter but deceased in another (edge case, but architecturally cleaner).

```typescript
// ADD to memberships table in membership.schema.ts
dateOfDeath: date('date_of_death'),
```

### Pattern 4: TypeSpec Enum + Operations

```typescript
// MODIFY MembershipStatus enum in membership.tsp
enum MembershipStatus {
  // ... existing values ...
  resigned: "resigned",
  deceased: "deceased",
  expelled: "expelled",
}

// ADD two operations in the MembershipManagement interface
@doc("Record a member's voluntary resignation.")
@operationId("resignMembership")
@post
@route("/{membershipId}/resign")
@useAuth(bearerAuth)
@extension("x-security-required-roles", #["association:admin"])
resignMembership(
  @path membershipId: string,
  @body body: MembershipResignRequest
): ApiOkResponse<Membership>
  | ApiBadRequestResponse
  | ApiNotFoundResponse
  | ApiConflictResponse
  | ApiForbiddenResponse;

@doc("Record a member's death.")
@operationId("deceaseMembership")
@post
@route("/{membershipId}/deceased")
@useAuth(bearerAuth)
@extension("x-security-required-roles", #["association:admin"])
deceaseMembership(
  @path membershipId: string,
  @body body: MembershipDeceasedRequest
): ApiOkResponse<Membership>
  | ApiBadRequestResponse
  | ApiNotFoundResponse
  | ApiConflictResponse
  | ApiForbiddenResponse;
```

### Anti-Patterns to Avoid

- **Boolean `isDeceased` / `isResigned` fields:** Contradicts LIF-04 design decision. Always use status enum.
- **Skipping TypeSpec step:** CLAUDE.md mandates spec-first. Always update TypeSpec before implementing handlers.
- **Modifying generated files:** Never touch `services/api-ts/src/generated/openapi/*`.
- **Non-transactional invoice void:** The membership status update and invoice void MUST be in one transaction. A partial failure (status=resigned but invoices still open) would allow duplicate billing.
- **Editing `updateMember.ts` VALID_TRANSITIONS:** The existing state machine in `updateMember.ts` handles generic officer transitions. New departure handlers are separate endpoints (like `terminateMembership`), not wired through `updateMember`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Invoice void on departure | Custom SQL in handler | `db.transaction` + `notInArray` guard | Idempotent, atomic, consistent with `dues.repo.ts` |
| Position check | Custom role check | `requirePosition(ctx, [...])` utility | Already handles 2FA, position title matching |
| Audit trail | Manual DB insert | `auditAction(ctx, {...})` | Consistent audit schema, used by all handlers |
| Status guard | Ad-hoc if chains | `TERMINAL_STATUSES` constant + early throw | Reusable, testable |

## Common Pitfalls

### Pitfall 1: PostgreSQL pgEnum ALTER is safe but migration must be generated
**What goes wrong:** Developer manually edits enum values in schema but forgets to run `bun run db:generate`.
**Why it happens:** Drizzle does not auto-run migrations.
**How to avoid:** Wave 0 task: run `cd services/api-ts && bun run db:generate` after schema edit, review generated SQL.
**Warning signs:** `invalid input value for enum membership_status: "resigned"` at runtime.

### Pitfall 2: TypeSpec build must precede code generation
**What goes wrong:** Handler stubs reference types that haven't been generated yet.
**Why it happens:** `@monobase/api-spec` types are generated from TypeSpec output.
**How to avoid:** Step order: TypeSpec edit → `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → implement handlers.

### Pitfall 3: `lapsed` already exists in enum
**What goes wrong:** Adding `lapsed` to the pgEnum causes a duplicate value error.
**Why it happens:** `lapsed` is already in `membershipStatusEnum`. The CONTEXT.md lists it but it's already there.
**How to avoid:** Only add `resigned`, `deceased`, `expelled`. Skip `lapsed` in the enum extension.

### Pitfall 4: Notification exclusion is already implicit but needs explicit test
**What goes wrong:** `reminderProcessor.ts` already filters `['active', 'gracePeriod']` — departed statuses are excluded. But no test asserts this for the new statuses.
**Why it happens:** Implicit filtering is invisible to future devs.
**How to avoid:** Add unit test verifying `resigned`/`deceased` members receive 0 reminders.

### Pitfall 5: Session revocation for departed members
**What goes wrong:** Resigned/deceased member's active sessions remain valid.
**Why it happens:** `terminateMembership.ts` does revoke sessions (P1-4 fix), but new departure handlers won't unless explicitly coded.
**How to avoid:** Copy the session revocation block from `terminateMembership.ts` into both new handlers.

## Code Examples

### Verified: existingInvoice void pattern (from dues.repo.ts)
```typescript
// Source: services/api-ts/src/handlers/association:member/repos/dues.repo.ts line 101
// notInArray already used for overdue detection — same pattern for void
notInArray(duesInvoices.status, ['paid', 'cancelled', 'writtenOff'])
```

### Verified: requirePosition usage (from generateDuesInvoicesForOrg.ts)
```typescript
// Source: services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;
```

### Verified: Test pattern (from terminateMembership.test.ts)
```typescript
// Source: services/api-ts/src/handlers/association:member/terminateMembership.test.ts
mocks = stubRepo(MembershipRepository, {
  findOneById: async () => fakeMembership,
  updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
});
const ctx = makeCtx({ _params: { membershipId: 'mem-1' }, _body: { terminationReason: 'Voluntary resignation' } });
const response = await resignMembership(ctx);
expect(response.status).toBe(200);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boolean `is_terminated` flag | Status enum with `terminated` | Phase 15 | More states, richer queries |
| Generic `updateMember` for all transitions | Dedicated handler per terminal action | Established pattern | Cleaner auth, clearer intent |

**Already in schema (no new fields needed):**
- `terminatedAt` timestamp — exists on `memberships`
- `terminationReason` varchar(500) — exists on `memberships`

**Missing (must add):**
- `resigned`, `deceased`, `expelled` enum values
- `dateOfDeath` date field on `memberships`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dateOfDeath` does not exist on person schema — confirmed by grep | Schema section | Low — grep was definitive |
| A2 | Session revocation is desired for resigned/deceased (following terminated pattern) | Anti-patterns | Medium — if not desired, remove from handler |
| A3 | `expelled` status is in scope for enum extension (mentioned in CONTEXT.md decisions) | Standard Stack | Low — CONTEXT.md is explicit |

## Open Questions

1. **Should `expelled` also have a dedicated handler?**
   - What we know: CONTEXT.md adds `expelled` to the enum but only mentions handlers for resigned and deceased.
   - What's unclear: Is expelled handled via the existing `terminateMembership` endpoint with a reason, or does it need its own endpoint?
   - Recommendation: Planner should scope `expelled` as enum-only (no dedicated handler) for Phase 23. Officer uses `terminateMembership` with reason "Expelled". Dedicated handler can be Phase 24 if needed.

2. **Does `dateOfDeath` belong on membership or person?**
   - What we know: No death date field exists anywhere. CONTEXT.md says "person record (already may exist via Better-Auth)" — it does not exist.
   - What's unclear: Cross-org validity (person dead is dead everywhere; membership deceased is org-scoped).
   - Recommendation: Add to `memberships` table for simplicity and org-scoping. A person can theoretically have a membership marked deceased in one org and active in another (unlikely but architecturally correct). If the planner wants it on `persons`, add `dateOfDeath date` to `person.schema.ts` instead.

## Environment Availability

Step 2.6: SKIPPED — phase is code/config changes only. All required tools (Bun, PostgreSQL, Drizzle) already confirmed running in prior phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | none — inline bun:test |
| Quick run command | `cd services/api-ts && bun test src/handlers/association:member/resignMembership.test.ts src/handlers/association:member/deceaseMembership.test.ts` |
| Full suite command | `cd services/api-ts && bun test src/**/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIF-01 | Officer resigns member → status=resigned, terminationReason stored | unit | `bun test src/handlers/association:member/resignMembership.test.ts` | Wave 0 |
| LIF-01 | Non-officer cannot resign member → 403 | unit | same file | Wave 0 |
| LIF-01 | Cannot resign already-terminal member → BusinessLogicError | unit | same file | Wave 0 |
| LIF-01 | Open invoices voided in same transaction | unit | same file | Wave 0 |
| LIF-02 | Officer marks member deceased → status=deceased, dateOfDeath stored | unit | `bun test src/handlers/association:member/deceaseMembership.test.ts` | Wave 0 |
| LIF-02 | dateOfDeath required on deceased request | unit | same file | Wave 0 |
| LIF-03 | generateDuesInvoicesForOrg skips resigned/deceased members | unit | existing test + extend | ✅ (extend) |
| LIF-03 | reminderProcessor sends 0 reminders to resigned/deceased members | unit | extend reminderProcessor.test.ts | ✅ (extend) |
| LIF-04 | Enum includes resigned, deceased, expelled | schema test / migration | verify migration generated | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test src/handlers/association:member/resignMembership.test.ts src/handlers/association:member/deceaseMembership.test.ts`
- **Per wave merge:** `bun test src/**/*.test.ts`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/handlers/association:member/resignMembership.test.ts` — covers LIF-01
- [ ] `src/handlers/association:member/deceaseMembership.test.ts` — covers LIF-02
- [ ] Schema migration generated after enum extension

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `session` guard at handler start |
| V3 Session Management | yes | Revoke sessions on departure (P1-4 pattern from terminateMembership) |
| V4 Access Control | yes | `requirePosition([PRESIDENT, TREASURER, SECRETARY])` — officer-only |
| V5 Input Validation | yes | TypeSpec-generated validators (terminationReason minLength, dateOfDeath date type) |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Officer marks wrong member deceased | Tampering | Audit log on every departure action; irreversible by normal officers |
| Concurrent double-resignation | Tampering | Status guard in handler throws if already terminal |
| Departed member retains active session | Elevation of privilege | Session revocation block (mirror from terminateMembership.ts) |
| Bulk notification sent to deceased | Info disclosure | `inArray` filter in reminderProcessor already excludes non-active statuses |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `membership.schema.ts` — current enum values, existing fields
- [VERIFIED: codebase] `terminateMembership.ts` — handler pattern to mirror
- [VERIFIED: codebase] `generateDuesInvoicesForOrg.ts` — billing guard location
- [VERIFIED: codebase] `reminderProcessor.ts` — notification guard location (already correct)
- [VERIFIED: codebase] `dues.schema.ts` — invoice status enum includes 'cancelled'
- [VERIFIED: codebase] `membership.tsp` — TypeSpec MembershipStatus enum + terminateMembership op

### Secondary (MEDIUM confidence)
- [ASSUMED] PostgreSQL `ALTER TYPE ... ADD VALUE` is non-destructive — standard PG behavior, not verified in this session's migration output

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against live codebase
- Architecture: HIGH — based on direct code inspection of all integration points
- Pitfalls: HIGH — two pitfalls (lapsed duplicate, session revocation) discovered from code inspection

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable domain, changes only if schema or handler patterns change)
