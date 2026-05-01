import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListMembershipApplicationsQuery } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from './repos/membership.repo';

/**
 * listMembershipApplications
 *
 * Path: GET /association/member/applications
 * OperationId: listMembershipApplications
 */
export async function listMembershipApplications(
  ctx: ValidatedContext<never, ListMembershipApplicationsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const tenantId = ctx.get('tenantId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      tenantId,
      orgId: (query as any).orgId,
      status: (query as any).status,
    },
    { pagination: { offset, limit } },
  );

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: result.data,
    pagination: {
      offset,
      limit,
      count: result.data.length,
      totalCount: result.totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
