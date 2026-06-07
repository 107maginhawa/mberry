import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListInstitutionalMembershipsQuery } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository } from '@/handlers/association:member/repos/institutional-membership.repo';

/**
 * listInstitutionalMemberships
 *
 * Path: GET /association/member/institutional-memberships
 * OperationId: listInstitutionalMemberships
 */
export async function listInstitutionalMemberships(
  ctx: ValidatedContext<never, ListInstitutionalMembershipsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new InstitutionalMembershipRepository(db, logger);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? query.pageSize ?? 20;

  const filters = {
    ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const { data, totalCount } = await repo.findManyWithPagination(filters, {
    pagination: { offset, limit },
  });

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json(
    {
      data,
      pagination: {
        offset,
        limit,
        count: data.length,
        totalCount,
        totalPages,
        currentPage,
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: offset > 0,
      },
    },
    200,
  );
}
