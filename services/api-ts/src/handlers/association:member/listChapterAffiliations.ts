import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListChapterAffiliationsQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { ChapterAffiliationRepository } from './repos/chapters.repo';

/**
 * listChapterAffiliations
 *
 * Path: GET /association/member/chapter-affiliations
 * OperationId: listChapterAffiliations
 */
export async function listChapterAffiliations(
  ctx: ValidatedContext<never, ListChapterAffiliationsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('orgId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ChapterAffiliationRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      orgId,
      personId: (query as any).personId,
      chapterId: (query as any).chapterId,
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
