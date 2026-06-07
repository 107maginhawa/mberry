import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListAffiliationTransfersQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { AffiliationTransferRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * listAffiliationTransfers
 *
 * Path: GET /association/member/affiliation-transfers
 * OperationId: listAffiliationTransfers
 */
export async function listAffiliationTransfers(
  ctx: ValidatedContext<never, ListAffiliationTransfersQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AffiliationTransferRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      personId: (query as Record<string, unknown>)['personId'] as string | undefined,
      status: (query as Record<string, unknown>)['status'] as string | undefined,
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
