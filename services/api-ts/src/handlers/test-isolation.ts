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
 * Body: { fixture?, memberCount?, officerEmail?, memberEmail? }
 *   - fixture: 'roster-with-3-members' | 'minimal'  (default: 'roster-with-3-members')
 *   - memberCount: number  (overrides fixture default; minimal=0, roster=3)
 *   - officerEmail: string (default 'test@memberry.ph' — the seeded president)
 *   - memberEmail: string (optional — when supplied, the seeded member with
 *     this email is granted an ACTIVE membership on the new org so
 *     member-persona specs can target the isolated org. No default: member
 *     enrollment is opt-in.)
 *
 * Returns: { orgId, slug, tierId, personIds, officerPersonId?, positionId?, memberPersonId? }
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
    memberEmail?: string | null;
  };
  const memberCount = body.memberCount ?? (body.fixture === 'minimal' ? 0 : 3);
  // Distinguish "not provided" (use default) from explicit null (opt out).
  const officerEmail =
    'officerEmail' in body
      ? body.officerEmail
      : 'test@memberry.ph';
  // memberEmail is opt-in — no default. Only when supplied do we enroll a
  // seeded member onto the fresh org.
  const memberEmail = body.memberEmail ?? null;

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
  //
  // Also grant officer terms to the other seeded leadership personas
  // (treasurer, secretary, society) so any storageState-backed test can
  // navigate to /officer/* on the isolated org without redirecting to
  // /dashboard. Each gets its own position row.
  let officerPersonId: string | undefined;
  let positionId: string | undefined;
  if (tier && officerEmail) {
    const sharedOfficerEmails = [
      officerEmail,
      'treasurer@memberry.ph',
      'secretary@memberry.ph',
      'society@memberry.ph',
    ];
    let sortOrder = 1;
    for (const email of sharedOfficerEmails) {
      const [officerUser] = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, email))
        .limit(1);
      if (!officerUser) continue;
      const positionTitle =
        email === officerEmail
          ? 'President'
          : email === 'treasurer@memberry.ph'
            ? 'Treasurer'
            : email === 'secretary@memberry.ph'
              ? 'Secretary'
              : 'Society Officer';
      const [pos] = await db
        .insert(positions)
        .values({
          organizationId: org.id,
          title: positionTitle,
          level: 'chapter',
          termLengthMonths: 12,
          sortOrder,
        })
        .returning({ id: positions.id });
      sortOrder += 1;
      if (pos) {
        await db.insert(officerTerms).values({
          positionId: pos.id,
          personId: officerUser.id,
          organizationId: org.id,
          status: 'active',
          startDate: TERM_START,
          endDate: TERM_END,
        });
        // Return the default-officer's ids in the response for backward
        // compatibility with callers that read officerPersonId/positionId.
        if (email === officerEmail) {
          officerPersonId = officerUser.id;
          positionId = pos.id;
        }
      }
    }
  }

  // Member-persona provisioning (CONTINUE-60). When a memberEmail is
  // supplied, resolve the seeded member's person.id via their better-auth
  // user row and grant them an ACTIVE membership on the new org. Mirrors
  // the officer path above; lets member specs target fx().orgId while
  // signing in as the seeded member.
  let memberPersonId: string | undefined;
  if (tier && memberEmail) {
    const [memberUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, memberEmail))
      .limit(1);
    if (memberUser) {
      // Avoid duplicate membership if one somehow already exists.
      const [existing] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, org.id),
            eq(memberships.personId, memberUser.id),
          ),
        )
        .limit(1);
      if (!existing) {
        await db.insert(memberships).values({
          organizationId: org.id,
          personId: memberUser.id,
          tierId: tier.id,
          memberNumber: `T-${suffix}-MEMBER`,
          startDate: new Date().toISOString().split('T')[0]!,
          duesExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]!,
          gracePeriodDays: 30,
          status: 'active',
          joinedAt: new Date(),
        });
      }
      memberPersonId = memberUser.id;
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
      memberPersonId,
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
