import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { memberships } from './repos/membership.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { eq } from 'drizzle-orm';

/**
 * getMyMemberships
 *
 * Returns all memberships for the authenticated user across all organizations.
 * Enriches each membership with orgId and orgName from the organization table.
 */
export async function getMyMemberships(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;

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
      removedAt: memberships.removedAt,
      removalReason: memberships.removalReason,
      note: memberships.note,
      orgName: organizations.name,
    })
    .from(memberships)
    .leftJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.personId, user.id));

  // Map to include orgId alias that frontend expects
  const data = rows.map((r) => ({
    ...r,
    orgId: r.organizationId,
  }));

  return ctx.json({ data }, 200);
}
