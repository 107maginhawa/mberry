/**
 * Test-only endpoints for per-test fixture isolation.
 *
 * E2E specs that mutate shared seeded rows (events, members, dues, etc.)
 * poison each other under parallel execution. These endpoints let each
 * spec spin up a private org with its own members + tier and tear it
 * down in afterAll — removing all shared-state coupling.
 *
 * Guarded by NODE_ENV !== 'production'. Mounted at /test/* in app.ts.
 *
 * See docs/audits/E2E_REMEDIATION_FINAL.md §Parallel contamination.
 */

import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
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

/**
 * POST /test/isolated-fixture
 * Body: { fixture: 'roster-with-3-members' | 'minimal' }
 * Returns: { orgId, slug, tierId, personIds }
 */
export async function createIsolatedFixture(ctx: Context): Promise<Response> {
  if (process.env['NODE_ENV'] === 'production') {
    return ctx.json({ error: 'Not available in production' }, 404);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const body = (await ctx.req.json().catch(() => ({}))) as {
    fixture?: string;
    memberCount?: number;
  };
  const memberCount = body.memberCount ?? (body.fixture === 'minimal' ? 0 : 3);

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

  return ctx.json(
    {
      orgId: org.id,
      slug,
      tierId: tier?.id,
      personIds,
    },
    201,
  );
}

/**
 * DELETE /test/isolated-fixture/:orgId
 * Tears down an isolated fixture (cascade-deletes its membership rows etc).
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

  // Cascade: memberships → tier → org. Persons stay (cheap, simplifies FK).
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(membershipTiers).where(eq(membershipTiers.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  return ctx.json({ ok: true, deleted: true }, 200);
}
