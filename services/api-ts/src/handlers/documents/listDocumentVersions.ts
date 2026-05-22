import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListDocumentVersionsQuery, ListDocumentVersionsParams } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DocumentVersionRepository } from './repos/documents.repo';

/**
 * listDocumentVersions
 *
 * Path: GET /association/documents/{documentId}/versions
 * OperationId: listDocumentVersions
 */
export async function listDocumentVersions(
  ctx: ValidatedContext<never, ListDocumentVersionsQuery, ListDocumentVersionsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentVersionRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    { documentId: params.documentId },
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
