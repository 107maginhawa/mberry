/**
 * Test-only endpoints for per-test fixture isolation.
 *
 * E2E specs that mutate shared seeded rows (events, members, dues, etc.)
 * poison each other under parallel execution. These endpoints let each
 * spec spin up a private org with its own members + tier + officer term
 * and tear it down in afterAll — removing all shared-state coupling.
 *
 * Guarded by NODE_ENV !== 'production'. Mounted at /test/* in app.ts.
 *
 * See docs/audits/E2E_REMEDIATION_FINAL.md §Parallel contamination.
 */

import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  membershipTiers,
  memberships,
} from '@/handlers/association:member/repos/membership.schema';
import {
  associations,
  organizations,
} from '@/handlers/platformadmin/repos/platform-admin.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import {
  positions,
  officerTerms,
} from '@/handlers/association:member/repos/governance.schema';
import { user as userTable } from '@/generated/better-auth/schema';

const TERM_START = new Date(Date.UTC(2025, 0, 1));
const TERM_END = new Date(Date.UTC(2026, 11, 31));

/**
 * POST /test/isolated-fixture
 * Body: { fixture?, memberCount?, officerEmail? }
 *   - fixture: 'roster-with-3-members' | 'minimal'  (default: 'roster-with-3-members')
 *   - memberCount: number  (overrides fixture default; minimal=0, roster=3)
 *   - officerEmail: string (default 'test@memberry.ph' — the seeded president)
 *
 * Returns: { orgId, slug, tierId, personIds, officerPersonId?, positionId? }
 *
 * When officerEmail resolves to an existing seeded user, this also creates
 * a President position + active officer_term on the new org. That makes
 * the response usable by specs that consume storageState('officer') and
 * expect officer perms on the isolated org.
 */
export async function createIsolatedFixture(ctx: Context): Promise<Response> {
  if (process.env['NODE_ENV'] === 'production') {
    return ctx.json({ error: 'Not available in production' }, 404);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const body = (await ctx.req.json().catch(() => ({}))) as {
    fixture?: string;
    memberCount?: number;
    officerEmail?: string | null;
  };
  const memberCount = body.memberCount ?? (body.fixture === 'minimal' ? 0 : 3);
  // Distinguish "not provided" (use default) from explicit null (opt out).
  const officerEmail =
    'officerEmail' in body
      ? body.officerEmail
      : 'test@memberry.ph';

  // Find or reuse a default association (test orgs all belong to PDA).
  const [assoc] =
    (await db.select().from(associations).limit(1)) ?? [];
  if (!assoc) {
    return ctx.json({ error: 'No association seeded — run db:seed first' }, 500);
  }

  const suffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const slug = `test-isolated-${suffix}`;
  const name = `Test Isolated Org ${suffix}`;

  const [org] = await db
    .insert(organizations)
    .values({
      associationId: assoc.id,
      name,
      slug,
      orgType: 'chapter',
      region: 'NCR',
      contactEmail: `${slug}@test.local`,
      status: 'active',
    })
    .returning({ id: organizations.id });

  if (!org) {
    return ctx.json({ error: 'Failed to create org' }, 500);
  }

  const [tier] = await db
    .insert(membershipTiers)
    .values({
      organizationId: org.id,
      name: 'Regular',
      code: 'REGULAR',
      annualFee: 3000,
      currency: 'PHP',
    })
    .returning({ id: membershipTiers.id });

  const personIds: string[] = [];
  if (tier) {
    for (let i = 0; i < memberCount; i++) {
      const [person] = await db
        .insert(persons)
        .values({
          firstName: `Member${i + 1}`,
          lastName: suffix.slice(0, 6),
          contactInfo: { email: `m${i + 1}-${suffix}@test.local` },
        })
        .returning({ id: persons.id });
      if (person) {
        personIds.push(person.id);
        await db.insert(memberships).values({
          organizationId: org.id,
          personId: person.id,
          tierId: tier.id,
          memberNumber: `T-${suffix}-${i + 1}`,
          startDate: new Date().toISOString().split('T')[0]!,
          duesExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]!,
          gracePeriodDays: 30,
          status: 'active',
          joinedAt: new Date(),
        });
      }
    }
  }

  // Officer-term provisioning (F2). Resolve the seeded officer's
  // person.id via their better-auth user row (user.id == person.id for
  // users created by the better-auth user.create.after hook), then
  // INSERT a chapter-level position + active officer_term on the new org.
  let officerPersonId: string | undefined;
  let positionId: string | undefined;
  if (tier && officerEmail) {
    const [officerUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, officerEmail))
      .limit(1);
    if (officerUser) {
      officerPersonId = officerUser.id;
      const [pos] = await db
        .insert(positions)
        .values({
          organizationId: org.id,
          title: 'President',
          level: 'chapter',
          termLengthMonths: 12,
          sortOrder: 1,
        })
        .returning({ id: positions.id });
      if (pos) {
        positionId = pos.id;
        await db.insert(officerTerms).values({
          positionId: pos.id,
          personId: officerPersonId,
          organizationId: org.id,
          status: 'active',
          startDate: TERM_START,
          endDate: TERM_END,
        });
      }
    }
  }

  return ctx.json(
    {
      orgId: org.id,
      slug,
      tierId: tier?.id,
      personIds,
      officerPersonId,
      positionId,
    },
    201,
  );
}

/**
 * DELETE /test/isolated-fixture/:orgId
 * Tears down an isolated fixture (cascade-deletes its officer term,
 * position, memberships, tier, then the org itself).
 */
export async function deleteIsolatedFixture(ctx: Context): Promise<Response> {
  if (process.env['NODE_ENV'] === 'production') {
    return ctx.json({ error: 'Not available in production' }, 404);
  }
  const orgId = ctx.req.param('orgId');
  if (!orgId) return ctx.json({ error: 'orgId required' }, 400);

  const db = ctx.get('database') as DatabaseInstance;
  // Defensive: only delete orgs whose slug starts with our test prefix
  // — never let this nuke a real seeded org.
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return ctx.json({ ok: true, deleted: false }, 200);
  if (!org.slug.startsWith('test-isolated-')) {
    return ctx.json(
      { error: 'Refusing to delete a non-isolated org' },
      403,
    );
  }

  // Cascade order: officer_term → position → memberships → tier → org.
  // Persons stay (cheap, simplifies FK).
  await db.delete(officerTerms).where(eq(officerTerms.organizationId, orgId));
  await db.delete(positions).where(eq(positions.organizationId, orgId));
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(membershipTiers).where(eq(membershipTiers.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  return ctx.json({ ok: true, deleted: true }, 200);
}
