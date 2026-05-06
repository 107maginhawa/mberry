import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListMembershipTiersQuery } from '@/generated/openapi/validators';
import { MembershipTierRepository } from './repos/membership.repo';

/**
 * listMembershipTiers
 *
 * Path: GET /association/member/tiers
 * OperationId: listMembershipTiers
 */
export async function listMembershipTiers(
  ctx: ValidatedContext<never, ListMembershipTiersQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('orgId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipTierRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    { orgId, q: query.q as string | undefined },
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
