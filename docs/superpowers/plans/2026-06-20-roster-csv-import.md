# Roster CSV Import (D1 / ISSUE-026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an officer upload a member CSV and have new members (people not yet in the system) created and enrolled, instead of every new-member row failing.

**Architecture:** The import endpoint becomes match-or-create. For each CSV row, the server looks up an existing person globally by email or license number; if none, it creates a PII-only person record; then it creates a membership for the current org (skipping anyone who is already a member). A dedicated `ImportMemberRow` contract carries identity fields (name/email/license) so the existing single-add `AddMemberRequest` stays untouched. The frontend already parses CSV; it gains a required tier dropdown, sends real fields, shows a richer result, and offers a downloadable template.

**Tech Stack:** TypeSpec → OpenAPI → generated validators (Hono) + generated SDK (`@hey-api/openapi-ts`) + TanStack Query; Drizzle ORM (PostgreSQL); Bun test; React + TanStack Router.

## Global Constraints

- Spec-first: edit TypeSpec, never generated files (`services/api-ts/src/generated/**`, `packages/sdk-ts/src/generated/**`). Regenerate after TypeSpec edits.
- Regen pipeline order: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → `cd packages/sdk-ts && bun run generate`.
- Handler verb/audit conventions already satisfied by the existing op (`importRosterMembers`, `x-audit`, `x-security-required-roles`). Do not add hand-rolled `auditAction`.
- Toasts use `sonner` (already imported in the frontend page).
- API server has no hot-reload — restart after backend changes for manual testing.
- Person email lives in `contactInfo` JSONB under key `email` (`ContactInfo { email?, phone? }`); `person.licenseNumber` is a plain varchar. Person `id` is `uuid().primaryKey().defaultRandom()` — omit it on insert to get a fresh id (a PII-only record with no auth user). `membership.personId` is `notNull` but has NO foreign key to `person`.
- Membership `(organizationId, personId)` is a DB unique constraint. Dedup via the existing `MembershipRepository.findByPersonAndOrg` pre-check, not by catching the unique violation.

## File Structure

- `services/api-ts/src/handlers/person/repos/person.repo.ts` — add `findByEmailOrLicense` (Task 1).
- `services/api-ts/src/handlers/person/repos/person.repo.test.ts` — new unit test for the lookup (Task 1). (If a test file already exists, append the describe block instead of creating.)
- `specs/api/src/association/member/membership.tsp` — `ImportMemberRow`, `ImportMembersRequest.tierId`, `ImportRowError`, structured `ImportResult.errors` (Task 2).
- `services/api-ts/src/handlers/member/membership/importRosterMembers.ts` — rewrite to match-or-create (Task 2).
- `services/api-ts/src/handlers/member/membership/importRosterMembers.test.ts` — rewrite for the new contract (Task 2).
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/import.tsx` — tier dropdown, real fields, richer result, template download, no-tiers state (Task 3).

---

### Task 1: `PersonRepository.findByEmailOrLicense`

Global person lookup by email (JSONB) or license number. Used by the import handler to match before creating.

**Files:**
- Modify: `services/api-ts/src/handlers/person/repos/person.repo.ts` (add `sql` import + method)
- Test: `services/api-ts/src/handlers/person/repos/person.repo.test.ts`

**Interfaces:**
- Produces: `findByEmailOrLicense(email?: string, licenseNumber?: string): Promise<Person | null>` — returns the first matching person globally, or `null` when no criteria are given or nothing matches.

- [ ] **Step 1: Write the failing test**

Create `services/api-ts/src/handlers/person/repos/person.repo.test.ts` (or append the `describe` if the file exists):

```ts
import { describe, test, expect } from 'bun:test';
import { PersonRepository } from './person.repo';

// Minimal hand-rolled db stub capturing the drizzle select chain. We assert the
// guard (no criteria → no query) and the "first row" return, not the SQL text.
function dbReturning(rows: any[]) {
  let selected = false;
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => { selected = true; return rows; } }),
        }),
      }),
    } as any,
    wasQueried: () => selected,
  };
}

describe('PersonRepository.findByEmailOrLicense', () => {
  test('returns null and skips the query when neither email nor license is given', async () => {
    const { db, wasQueried } = dbReturning([{ id: 'p-1' }]);
    const repo = new PersonRepository(db);
    const result = await repo.findByEmailOrLicense(undefined, undefined);
    expect(result).toBeNull();
    expect(wasQueried()).toBe(false);
  });

  test('returns the first matching person when email is given', async () => {
    const { db } = dbReturning([{ id: 'p-1', firstName: 'Ada' }]);
    const repo = new PersonRepository(db);
    const result = await repo.findByEmailOrLicense('ada@example.com');
    expect(result).toEqual({ id: 'p-1', firstName: 'Ada' } as any);
  });

  test('returns null when nothing matches', async () => {
    const { db } = dbReturning([]);
    const repo = new PersonRepository(db);
    const result = await repo.findByEmailOrLicense(undefined, 'LIC-404');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/person/repos/person.repo.test.ts`
Expected: FAIL — `repo.findByEmailOrLicense is not a function`.

- [ ] **Step 3: Add the `sql` import**

In `person.repo.ts`, change the drizzle import (line 6) from:

```ts
import { eq, and, or, ilike, type SQL } from 'drizzle-orm';
```

to:

```ts
import { eq, and, or, ilike, sql, type SQL } from 'drizzle-orm';
```

- [ ] **Step 4: Add the method**

In `person.repo.ts`, inside the `PersonRepository` class (e.g. after `ensurePersonForUser`, before the closing brace at line ~120):

```ts
  /**
   * Find a person globally by email (stored in the contactInfo JSONB) or by
   * license number. Person is cross-org PII, so this lookup is NOT org-scoped:
   * the same person may hold memberships in several associations. Returns the
   * first match, or null when no criteria are supplied or nothing matches.
   *
   * ponytail: email is non-unique/unindexed in JSONB — first match wins. Roster
   * collisions are rare; tighten to a unique index only if duplicates bite.
   */
  async findByEmailOrLicense(
    email?: string,
    licenseNumber?: string,
  ): Promise<Person | null> {
    const conds: SQL<unknown>[] = [];
    if (email) conds.push(sql`${persons.contactInfo}->>'email' = ${email}`);
    if (licenseNumber) conds.push(eq(persons.licenseNumber, licenseNumber));
    if (conds.length === 0) return null;

    const [record] = await this.db
      .select()
      .from(persons)
      .where(or(...conds))
      .limit(1);

    return (record as Person) || null;
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/person/repos/person.repo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add services/api-ts/src/handlers/person/repos/person.repo.ts services/api-ts/src/handlers/person/repos/person.repo.test.ts
git commit -m "feat(person): add findByEmailOrLicense for roster import match (ISSUE-026)"
```

---

### Task 2: Import contract + match-or-create handler

Extend the TypeSpec contract with an identity-carrying import row and a batch `tierId`, regenerate, then rewrite the handler to match-or-create and rewrite its test.

**Files:**
- Modify: `specs/api/src/association/member/membership.tsp` (lines ~597-619 region + add `ImportRowError`)
- Modify (regenerated, do not hand-edit): `services/api-ts/src/generated/**`, `packages/sdk-ts/src/generated/**`
- Modify: `services/api-ts/src/handlers/member/membership/importRosterMembers.ts`
- Test: `services/api-ts/src/handlers/member/membership/importRosterMembers.test.ts`

**Interfaces:**
- Consumes: `PersonRepository.findByEmailOrLicense` (Task 1); `MembershipRepository.findByPersonAndOrg(personId, orgId)`, `MembershipRepository.createOne`, `MembershipTierRepository.findOneById(id)` (existing).
- Produces: request body type `ImportRosterMembersBody` with shape `{ organizationId: string; tierId: string; members: Array<{ firstName?, lastName?, email?, licenseNumber?, memberNumber? }> }`; response `{ imported, skipped, failed, errors: Array<{ index, error }> }`.

- [ ] **Step 1: Edit the TypeSpec contract**

In `specs/api/src/association/member/membership.tsp`, replace the `ImportMembersRequest` and `ImportResult` models (currently lines ~597-619) with:

```tsp
@doc("A single member row in a roster import. Identity is resolved server-side: a person is matched globally by email or license number, and created if none exists.")
model ImportMemberRow {
  @doc("First name — required to CREATE a new person; optional when an existing person is matched")
  @maxLength(50)
  firstName?: string;

  @doc("Last name")
  @maxLength(50)
  lastName?: string;

  @doc("Email address — used to match/create the person (email or licenseNumber required)")
  @maxLength(254)
  email?: string;

  @doc("Professional license number — used to match/create the person (email or licenseNumber required)")
  @maxLength(50)
  licenseNumber?: string;

  @doc("Human-readable member number to store on the membership")
  @maxLength(50)
  memberNumber?: string;
}

@doc("Request to import multiple members from an external source (e.g. CSV)")
model ImportMembersRequest {
  @doc("ID of the organization to import members into")
  organizationId: string;

  @doc("Membership tier assigned to every imported member in this batch")
  tierId: string;

  @doc("Array of member rows to import")
  members: ImportMemberRow[];
}

@doc("A single failed row in a roster import")
model ImportRowError {
  @doc("Zero-based index of the failed row within the request")
  index: int32;

  @doc("Human-readable reason the row failed")
  error: string;
}

@doc("Result of a bulk member import operation")
model ImportResult {
  @doc("Number of new memberships created")
  imported: int32;

  @doc("Number of rows skipped because the person is already a member of this org")
  skipped: int32;

  @doc("Number of rows that failed validation or insert")
  failed: int32;

  @doc("Structured errors for failed rows")
  errors: ImportRowError[];
}
```

- [ ] **Step 2: Regenerate the spec, validators, and SDK**

Run:
```bash
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
cd ../../packages/sdk-ts && bun run generate
```
Expected: all three succeed. After this, `ImportRosterMembersBody` no longer has per-row `personId`/`tierId`, so `importRosterMembers.ts` has TypeScript errors — that is expected and fixed in Step 4.

- [ ] **Step 3: Write the failing handler test (rewrite the file)**

Replace the entire contents of `services/api-ts/src/handlers/member/membership/importRosterMembers.test.ts` with:

```ts
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { importRosterMembers } from './importRosterMembers';
import { MembershipRepository, MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

describe('importRosterMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let tierMocks: ReturnType<typeof stubRepo>;
  let personMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    [mocks, tierMocks, personMocks, officerMocks].forEach((m) => {
      if (m) Object.values(m).forEach((x) => x.mockRestore());
    });
  });

  function grantOfficer() {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  }

  // Tier always resolves to one owned by the test org unless overridden.
  function validTier(orgId = 'org-9') {
    tierMocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1', organizationId: orgId }),
    });
  }

  test('matches an existing person and creates a membership', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => ({ id: 'p-existing' }),
      createOne: async () => { throw new Error('should not create when matched'); },
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'm-1', personId: data.personId }),
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'ada@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.skipped).toBe(0);
    expect(res.body.failed).toBe(0);
  });

  test('creates a new person then a membership when no match', async () => {
    grantOfficer();
    validTier();
    let created = false;
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => null,
      createOne: async (data: any) => { created = true; return { id: 'p-new', firstName: data.firstName }; },
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'm-2', personId: data.personId }),
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ firstName: 'New', email: 'new@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(created).toBe(true);
    expect(res.body.imported).toBe(1);
  });

  test('skips a person who is already a member of this org', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => ({ id: 'p-existing' }),
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ id: 'm-existing' }),
      createOne: async () => { throw new Error('should not create for a skipped row'); },
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'dup@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  test('fails a row with neither email nor license', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, { findByEmailOrLicense: async () => null });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ firstName: 'NoKey' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.body.failed).toBe(1);
    const err = (res.body.errors as Array<{ index: number; error: string }>).find((e) => e.index === 0);
    expect(err!.error).toMatch(/email or licenseNumber/i);
  });

  test('fails a no-match row that is missing firstName (cannot create)', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => null,
      createOne: async () => { throw new Error('should not create without firstName'); },
    });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'ghost@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.body.failed).toBe(1);
    const err = (res.body.errors as Array<{ index: number; error: string }>).find((e) => e.index === 0);
    expect(err!.error).toMatch(/firstName/i);
  });

  test('returns 400 when the tier does not belong to the org', async () => {
    grantOfficer();
    tierMocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1', organizationId: 'other-org' }),
    });
    personMocks = stubRepo(PersonRepository, { findByEmailOrLicense: async () => null });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ firstName: 'A', email: 'a@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(400);
  });

  test('rejects an import exceeding the row cap (FIX-016)', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, { findByEmailOrLicense: async () => null });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const members = Array.from({ length: 501 }, (_, i) => ({ email: `p${i}@x.com`, firstName: 'X' }));
    const ctx = makeCtx({ organizationId: 'org-9', _body: { organizationId: 'org-9', tierId: 'tier-1', members } });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(400);
  });

  test('emits membership.imported with created personIds', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async (email: string) => ({ id: email === 'a@x.com' ? 'p-a' : 'p-b' }),
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'm', personId: data.personId }),
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({
        organizationId: 'org-9',
        _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'a@x.com' }, { email: 'b@x.com' }] },
      });
      const res = await importRosterMembers(ctx);
      expect(res.body.imported).toBe(2);
      const evt = emitted.find((x) => x.e === 'membership.imported');
      expect(evt).toBeDefined();
      expect(evt!.p.importedCount).toBe(2);
      expect(evt!.p.personIds).toEqual(['p-a', 'p-b']);
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  test('returns 403 when caller holds no qualifying officer position', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'a@x.com', firstName: 'A' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/member/membership/importRosterMembers.test.ts`
Expected: FAIL — the current handler validates per-row `personId`/`tierId`, has no tier check, no person/skip logic, and returns no `skipped`.

- [ ] **Step 5: Rewrite the handler**

Replace the entire contents of `services/api-ts/src/handlers/member/membership/importRosterMembers.ts` with:

```ts
import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ImportRosterMembersBody } from '@/generated/openapi/validators';
import {
  MembershipRepository,
  MembershipTierRepository,
} from '@/handlers/association:member/repos/membership.repo';
import type { NewMembership } from '@/handlers/association:member/repos/membership.schema';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import type { NewPerson } from '@/handlers/person/repos/person.schema';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * importRosterMembers
 *
 * Path: POST /association/member/roster/import
 * OperationId: importRosterMembers
 *
 * Match-or-create roster import. For each row: match a person globally by email
 * or license number; create a PII-only person if none exists; then create a
 * membership for this org, skipping anyone already a member.
 *
 * ponytail: imported people are PII-only records with no auth/login account.
 * Linking such a record when the person later signs up (ensurePersonForUser
 * keys by user.id) is a separate account-claiming feature, deliberately out of
 * scope for D1.
 */
export async function importRosterMembers(
  ctx: ValidatedContext<ImportRosterMembersBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const membershipRepo = new MembershipRepository(db, logger);
  const tierRepo = new MembershipTierRepository(db, logger);
  const personRepo = new PersonRepository(db, logger);

  // FIX-016 / G-13: cap the batch size — an unbounded array insert is an
  // abuse/runaway vector. 500 rows matches the spec §16 import-size target.
  const MAX_IMPORT_ROWS = 500;
  if (body.members.length > MAX_IMPORT_ROWS) {
    return ctx.json(
      {
        error: `Roster import exceeds the maximum of ${MAX_IMPORT_ROWS} rows per request (received ${body.members.length}). Split the file into smaller batches.`,
      },
      400,
    );
  }

  // Tier is required and must belong to this org. Validate once up front so a
  // bad tier fails the whole request clearly instead of 500-ing on every row.
  if (!body.tierId) {
    return ctx.json({ error: 'tierId is required' }, 400);
  }
  const tier = await tierRepo.findOneById(body.tierId);
  if (!tier || tier.organizationId !== orgId) {
    return ctx.json({ error: `Tier ${body.tierId} not found for this organization` }, 400);
  }

  // Membership start date defaults to today (no payment data in a CSV; status
  // falls back to the DB default 'pendingPayment').
  const today = new Date().toISOString().slice(0, 10); // plainDate YYYY-MM-DD

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];
  const importedPersonIds: string[] = [];

  for (let i = 0; i < body.members.length; i++) {
    const row = body.members[i];
    try {
      const email = row?.email?.trim() || undefined;
      const licenseNumber = row?.licenseNumber?.trim() || undefined;
      const firstName = row?.firstName?.trim() || undefined;

      if (!email && !licenseNumber) {
        failed++;
        errors.push({ index: i, error: 'email or licenseNumber is required to match or create a member' });
        continue;
      }

      // Match an existing person globally (person is cross-org PII).
      let person = await personRepo.findByEmailOrLicense(email, licenseNumber);

      // No match → create a PII-only record (no auth user).
      if (!person) {
        if (!firstName) {
          failed++;
          errors.push({ index: i, error: 'firstName is required to create a new member' });
          continue;
        }
        person = await personRepo.createOne({
          firstName,
          lastName: row?.lastName?.trim() || null,
          contactInfo: email ? { email } : null,
          licenseNumber: licenseNumber ?? null,
          createdBy: session.user.id,
        } as NewPerson);
      }

      // Dedup via explicit pre-check (not by catching the (org,person) unique
      // violation) so an existing member is a clean "skipped", not a "failed".
      const existing = await membershipRepo.findByPersonAndOrg(person.id, orgId);
      if (existing) {
        skipped++;
        continue;
      }

      await membershipRepo.createOne({
        organizationId: orgId,
        personId: person.id,
        tierId: body.tierId,
        startDate: today,
        memberNumber: row?.memberNumber?.trim() || null,
        createdBy: session.user.id,
      } as NewMembership);

      imported++;
      importedPersonIds.push(person.id);
    } catch (err) {
      failed++;
      errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
    }
  }

  ctx.set('auditResourceId', orgId);
  ctx.set('auditDescription', `Roster import: ${imported} imported, ${skipped} skipped, ${failed} failed`);

  // Cross-module visibility: imported members need welcome/onboarding follow-up.
  if (imported > 0) {
    domainEvents.emit('membership.imported', {
      organizationId: orgId,
      importedBy: session.user.id,
      importedCount: imported,
      personIds: importedPersonIds,
    }).catch(() => {});
  }

  return ctx.json({ imported, skipped, failed, errors }, 200);
}
```

- [ ] **Step 6: Run the handler test to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/member/membership/importRosterMembers.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Typecheck the API workspace**

Run: `cd services/api-ts && bun run typecheck`
Expected: exit 0. (If `findOneById` is reported missing on the tier repo, it is inherited from `DatabaseRepository` — confirm the base class exposes it; it does, per `core/database.repo.ts`.)

- [ ] **Step 8: Commit**

```bash
git add specs/api/src/association/member/membership.tsp services/api-ts/src/generated packages/sdk-ts/src/generated services/api-ts/src/handlers/member/membership/importRosterMembers.ts services/api-ts/src/handlers/member/membership/importRosterMembers.test.ts
git commit -m "feat(roster-import): match-or-create import contract + handler (ISSUE-026)"
```

---

### Task 3: Frontend — tier dropdown, real fields, richer result, template download

Wire the existing import page to the new contract: require a tier, send real identity fields, show imported/skipped/failed + per-row errors, and add a downloadable sample CSV.

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/import.tsx`

**Interfaces:**
- Consumes: `listMembershipTiersOptions` (query hook) and `importRosterMembersMutation` from `@monobase/sdk-ts/generated/react-query`; `useOrg` (`{ orgId, orgSlug }`). The tiers query response is a paginated envelope `{ data: MembershipTier[], pagination }`.
- Produces: import request body `{ organizationId, tierId, members: Array<{ firstName, lastName, email, licenseNumber, memberNumber }> }`.

- [ ] **Step 1: Add imports and tier loading + selection state**

At the top of `import.tsx`, extend the react-query import (line 7) and add the tiers query + tier-select state inside `RosterImportPage` (near the existing `useState` block, after line 107). Also add `Select` primitives and `useQuery`.

Change line 7 from:
```ts
import { importRosterMembersMutation } from '@monobase/sdk-ts/generated/react-query'
```
to:
```ts
import { importRosterMembersMutation, listMembershipTiersOptions } from '@monobase/sdk-ts/generated/react-query'
import { useQuery } from '@tanstack/react-query'
```

Add to the `@monobase/ui` import (line 4 / line 11 area) the Select primitives (mirror `join/$slug.tsx`):
```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from '@monobase/ui'
```
(If any of these are not exported from `@monobase/ui`, import them from the same path `join/$slug.tsx` uses — copy that file's import line for Select.)

Inside `RosterImportPage`, after `const [result, setResult] = useState(...)` (line 107), add:
```ts
  const tiersQuery = useQuery(listMembershipTiersOptions({ query: { limit: 200 } }))
  const tiers = tiersQuery.data?.data ?? []
  const [selectedTierId, setSelectedTierId] = useState('')
```

- [ ] **Step 2: Update the result state type and the import call**

Change the `result` state type (line 107) from:
```ts
  const [result, setResult] = useState<{ imported: number } | null>(null)
```
to:
```ts
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number; errors: Array<{ index: number; error: string }> } | null>(null)
```

Replace the body of `handleImport` (lines 138-168) with:
```ts
  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return
    if (!selectedTierId) {
      toast.error('Select a membership tier first')
      return
    }
    setImporting(true)

    try {
      // Send real identity fields; the server matches an existing person by
      // email/license or creates one, then enrols them in the selected tier.
      const members = parsed.rows
        .filter((r) => r.email || r.licenseNumber)
        .map((r) => ({
          firstName: r.firstName || undefined,
          lastName: r.lastName || undefined,
          email: r.email || undefined,
          licenseNumber: r.licenseNumber || undefined,
          memberNumber: r.memberNumber || undefined,
        }))

      const data = await (importMutOpts.mutationFn as (...args: unknown[]) => Promise<any>)({
        body: { organizationId: orgId, tierId: selectedTierId, members },
      })

      const r = data?.data ?? data ?? {}
      setResult({
        imported: r.imported ?? 0,
        skipped: r.skipped ?? 0,
        failed: r.failed ?? 0,
        errors: r.errors ?? [],
      })
      toast.success(`Imported ${r.imported ?? 0} members${r.skipped ? `, skipped ${r.skipped}` : ''}${r.failed ? `, ${r.failed} failed` : ''}`)
    } catch (err: unknown) {
      interface ApiErrorBody { message?: string; error?: string }
      const msg = err instanceof ApiError
        ? ((err.body as ApiErrorBody | null | undefined)?.message ?? (err.body as ApiErrorBody | null | undefined)?.error ?? 'Import failed')
        : (err instanceof Error ? err.message : 'Import failed')
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }
```

- [ ] **Step 3: Add a template-download handler**

Add this function inside `RosterImportPage` (next to `handleImport`):
```ts
  function downloadTemplate() {
    const csv = [
      'First Name,Last Name,Email,License Number,Member Number',
      'Juan,Dela Cruz,juan@example.com,PRC-123456,M-0001',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'roster-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
```

- [ ] **Step 4: Render the template button, tier dropdown, no-tiers guard, and richer result**

In the upload-area block (the `{!parsed && (...)}` GlassCard, lines ~191-215), add a template-download button above or below the drop zone. Inside the GlassCard, after the drop `<div>`, add:
```tsx
            <div className="px-4 pb-4 pt-2 text-center">
              <Button variant="link" size="sm" onClick={downloadTemplate}>
                Download template CSV
              </Button>
            </div>
```

In the preview block (`{parsed && !result && (...)}`, lines ~218-289), add the tier selector above the action buttons (before the `<div className="flex items-center justify-between">` or inside it on its own row). Insert:
```tsx
          {tiers.length === 0 ? (
            <div className="flex items-start gap-2 p-3 rounded-sm bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20">
              <AlertTriangle size={14} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-warning)]">
                No membership tiers exist yet. <Link to={`/org/${orgSlug}/officer/tiers`} className="underline">Create a tier</Link> before importing.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="import-tier">Membership Tier <span className="text-[var(--color-error)]">*</span></Label>
              <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                <SelectTrigger id="import-tier" className="w-full">
                  <SelectValue placeholder="Select a tier for all imported members..." />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
```

Disable the import button until a tier is chosen — change the import `<Button>` (line ~232) `disabled` prop from `disabled={importing}` to:
```tsx
                disabled={importing || !selectedTierId || tiers.length === 0}
```

Replace the result banner (lines ~182-188) with one that shows all counts and any errors:
```tsx
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-md bg-[var(--color-success-bg)] border border-[var(--color-success)]/20">
            <NavIcon icon={Check} className="text-[var(--color-success)]" />
            <p className="text-sm text-[var(--color-success)]">
              Imported {result.imported}
              {result.skipped > 0 ? ` · skipped ${result.skipped} (already members)` : ''}
              {result.failed > 0 ? ` · ${result.failed} failed` : ''}
            </p>
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-md border border-[var(--color-border-light)] p-3 text-xs space-y-1">
              {result.errors.slice(0, 50).map((e) => (
                <p key={e.index} className="text-[var(--color-muted)]">Row {e.index + 1}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
```
(Ensure `Link` is imported — it already is, line 2.)

- [ ] **Step 5: Typecheck and build the frontend**

Run: `cd apps/memberry && bun run typecheck`
Expected: exit 0. Fix any Select/Label import-path issues by copying the exact import line from `apps/memberry/src/routes/join/$slug.tsx`.

- [ ] **Step 6: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/org/\$orgSlug/officer/roster/import.tsx
git commit -m "feat(roster-import): tier dropdown, real fields, result detail, template download (ISSUE-026)"
```

---

### Task 4: End-to-end verification

Prove the whole slice works: full typecheck, full API test suite, build, and a manual officer click-through on the live stack.

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

Run: `bun run --filter '*' typecheck`
Expected: all workspaces exit 0.

- [ ] **Step 2: API test suite**

Run: `cd services/api-ts && bun test`
Expected: green (the rewritten import test + new repo test included; no regressions).

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: success across workspaces.

- [ ] **Step 4: Restart the API and run the live officer flow**

Restart the API (no hot-reload):
```bash
kill "$(lsof -ti tcp:7213)" 2>/dev/null; (cd services/api-ts && bun src/index.ts >/tmp/api.log 2>&1 &)
```
Then with memberry on :3004, sign in as the officer (`test@memberry.ph` / `TestPass123!`, org `pda-metro-manila`), go to Officer → Roster → Import. Use the `/browse` skill to:
- Download the template; confirm it has the header + sample row.
- Upload a small CSV with one brand-new member (unique email + firstName) and one existing member's email.
- Pick a tier, import, and confirm the result shows `imported: 1, skipped: 1` (or `failed` with a clear reason for a row missing email/firstName).
- Reload the roster list and confirm the new member appears.

- [ ] **Step 5: Commit any fixes from the click-through**

If the live run surfaces a bug, fix it, re-run the relevant test, and commit with a `fix(roster-import): ...` message referencing what broke.

---

## Self-Review

**Spec coverage:**
- Contract (identity fields, batch tier, structured errors) → Task 2 Step 1.
- Backend match-or-create + global match key (email then license) → Task 1 (lookup) + Task 2 Step 5.
- Dedup → skipped (pre-check) → Task 2 Step 5 + test Step 3.
- Partial failure `{imported, skipped, failed, errors}` → Task 2 Step 5.
- Create requires firstName; match needs email|license → Task 2 Step 5 + tests.
- Tier batch dropdown + zero-tiers guard → Task 3 Steps 1, 4.
- Sample template download → Task 3 Step 3.
- Status defaults pendingPayment (no CSV payment data) → Task 2 Step 5 (omits status, DB default applies).
- Account-claiming deferral noted in code → Task 2 Step 5 handler doc comment.
- Tests (handler cases + repo unit) → Task 1, Task 2.

**Placeholder scan:** No TBD/TODO; every code step shows full code. The only conditional note is the `@monobase/ui` Select/Label import path (instruction: copy the exact line from `join/$slug.tsx`) — concrete fallback, not a placeholder.

**Type consistency:** `findByEmailOrLicense(email?, licenseNumber?)` defined in Task 1, consumed identically in Task 2. Handler response `{imported, skipped, failed, errors:[{index,error}]}` matches the rewritten test assertions and the frontend result type. `ImportMemberRow` fields (firstName/lastName/email/licenseNumber/memberNumber) match the frontend `members.map`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-20-roster-csv-import.md`.
