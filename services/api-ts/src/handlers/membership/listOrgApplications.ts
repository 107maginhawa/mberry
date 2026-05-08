import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListOrgApplicationsQuery, ListOrgApplicationsParams } from '@/generated/openapi/validators';
import { membershipApplications } from '@/handlers/association:member/repos/membership.schema';
import { eq, and } from 'drizzle-orm';

/**
 * listOrgApplications
 *
 * Path: GET /applications/{orgId}
 * OperationId: listOrgApplications
 *
 * Returns membership applications for an organisation with optional status filter.
 * Used by officer dashboards.
 */
export async function listOrgApplications(
  ctx: ValidatedContext<never, ListOrgApplicationsQuery, ListOrgApplicationsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const orgId = params.orgId;

  const conditions = [eq(membershipApplications.organizationId, orgId)];
  if (query.status) {
    conditions.push(eq(membershipApplications.status, query.status as any));
  }

  const rows = await db
    .select()
    .from(membershipApplications)
    .where(and(...conditions));

  return ctx.json({ data: rows }, 200);
}
