import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchDocumentsQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';

/**
 * searchDocuments
 *
 * Path: GET /association/documents
 * OperationId: searchDocuments
 */
export async function searchDocuments(
  ctx: ValidatedContext<never, SearchDocumentsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('orgId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      orgId,
      ownerId: query.ownerId,
      ownerType: query.ownerType,
      accessLevel: query.accessLevel,
      category: query.category,
      q: query.q,
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
