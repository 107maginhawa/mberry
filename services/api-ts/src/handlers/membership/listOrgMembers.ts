import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { ListOrgMembersParams } from '@/generated/openapi/validators';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * listOrgMembers
 *
 * Path: GET /members/{orgId}
 * OperationId: listOrgMembers
 *
 * Returns all members of an organisation with joined person details.
 * Used by officer dashboards. Requires membership in the target org
 * (or platform admin) to prevent cross-org data access.
 */
export async function listOrgMembers(
  ctx: ValidatedContext<never, never, ListOrgMembersParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const params = ctx.req.valid('param');
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

  const rows = await db
    .select({
      id: memberships.id,
      personId: memberships.personId,
      firstName: persons.firstName,
      lastName: persons.lastName,
      status: memberships.status,
      memberNumber: memberships.memberNumber,
      duesExpiryDate: memberships.duesExpiryDate,
      categoryId: memberships.categoryId,
    })
    .from(memberships)
    .innerJoin(persons, eq(memberships.personId, persons.id))
    .where(eq(memberships.organizationId, orgId));

  return ctx.json({ data: rows }, 200);
}
