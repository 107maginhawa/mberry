import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListDuesConfigsQuery } from '@/generated/openapi/validators';
import { DuesConfigRepository } from './repos/dues.repo';

/**
 * listDuesConfigs
 *
 * Path: GET /association/member/dues-configs
 * OperationId: listDuesConfigs
 */
export async function listDuesConfigs(
  ctx: ValidatedContext<never, ListDuesConfigsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset) || 0;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesConfigRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    { organizationId: orgId },
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
