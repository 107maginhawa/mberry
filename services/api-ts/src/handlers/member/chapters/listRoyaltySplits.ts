import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListRoyaltySplitsQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * listRoyaltySplits
 *
 * Path: GET /association/member/royalty-splits
 * OperationId: listRoyaltySplits
 */
export async function listRoyaltySplits(
  ctx: ValidatedContext<never, ListRoyaltySplitsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const { chapterId, membershipId } = query as { chapterId?: string; membershipId?: string };
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new RoyaltySplitRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      chapterId,
      membershipId,
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
