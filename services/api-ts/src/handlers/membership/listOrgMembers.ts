import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListOrgMembersParams } from '@/generated/openapi/validators';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { eq } from 'drizzle-orm';

/**
 * listOrgMembers
 *
 * Path: GET /members/{orgId}
 * OperationId: listOrgMembers
 *
 * Returns all members of an organisation with joined person details.
 * Used by officer dashboards.
 */
export async function listOrgMembers(
  ctx: ValidatedContext<never, never, ListOrgMembersParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const params = ctx.req.valid('param');
  const orgId = params.orgId;

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
