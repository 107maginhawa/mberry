import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { ListDuesInvoicesQuery } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';

/**
 * listDuesInvoices
 *
 * Path: GET /association/member/dues-invoices
 * OperationId: listDuesInvoices
 */
export async function listDuesInvoices(
  ctx: ValidatedContext<never, ListDuesInvoicesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();
  const query = ctx.req.valid('query') as Record<string, unknown>;
  const offset = Number(query['offset']) || 0;
  const limit = Math.min(Number(query['limit']) || 20, 100);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      membershipId: query['membershipId'] as string | undefined,
      status: query['status'] as string | undefined,
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
