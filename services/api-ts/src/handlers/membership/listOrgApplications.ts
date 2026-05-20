import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { ListOrgApplicationsQuery, ListOrgApplicationsParams } from '@/generated/openapi/validators';
import { membershipApplications } from '@/handlers/association:member/repos/membership.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * listOrgApplications
 *
 * Path: GET /applications/{orgId}
 * OperationId: listOrgApplications
 *
 * Returns membership applications for an organisation with optional status filter.
 * Used by officer dashboards. Any officer of the org can access (D-01 shared-read).
 */
export async function listOrgApplications(
  ctx: ValidatedContext<never, ListOrgApplicationsQuery, ListOrgApplicationsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const orgId = params.organizationId;

  // Org-scoping: verify user belongs to this org (or is platform admin)
  const [admin] = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, user.id))
    .limit(1);

  if (!admin) {
    const [membership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.personId, user.id),
          eq(memberships.organizationId, orgId),
          inArray(memberships.status, ['active', 'gracePeriod']),
        )
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenError('Not a member of this organization');
    }
  }

  const conditions = [eq(membershipApplications.organizationId, orgId)];
  if (query.status) {
    conditions.push(eq(membershipApplications.status, query.status as typeof membershipApplications.status.enumValues[number]));
  }

  const rows = await db
    .select()
    .from(membershipApplications)
    .where(and(...conditions));

  return ctx.json({ data: rows }, 200);
}
