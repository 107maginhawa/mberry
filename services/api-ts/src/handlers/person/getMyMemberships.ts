import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { eq } from 'drizzle-orm';

/**
 * getMyMemberships
 *
 * Path: GET /persons/me/memberships
 * OperationId: getMyMemberships
 *
 * Returns all memberships for the authenticated user, enriched with orgName.
 */
export async function getMyMemberships(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;

  // Select only fields needed by frontend consumers — excludes PII-adjacent
  // fields (createdBy, updatedBy, note, removalReason) from member-tier response
  const rows = await db
    .select({
      id: memberships.id,
      organizationId: memberships.organizationId,
      personId: memberships.personId,
      tierId: memberships.tierId,
      categoryId: memberships.categoryId,
      memberNumber: memberships.memberNumber,
      startDate: memberships.startDate,
      duesExpiryDate: memberships.duesExpiryDate,
      gracePeriodDays: memberships.gracePeriodDays,
      status: memberships.status,
      joinedAt: memberships.joinedAt,
      orgName: organizations.name,
      orgSlug: organizations.slug,
    })
    .from(memberships)
    .leftJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.personId, personId));

  const data = rows.map((r) => ({
    ...r,
    orgId: r.organizationId,
  }));

  return ctx.json({ data, total: data.length }, 200);
}
