import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchDirectoryQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';

/**
 * searchDirectory
 *
 * Path: GET /association/member/directory/search
 * OperationId: searchDirectory
 */
export async function searchDirectory(
  ctx: ValidatedContext<never, SearchDirectoryQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  // Authenticated users can see 'public' and 'memberOnly' profiles
  // We search for both visibility levels; 'hidden' profiles are excluded
  const publicResult = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      visibility: 'public',
      q: (query as any).q,
    },
    { pagination: { offset, limit } },
  );

  const memberOnlyResult = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      visibility: 'memberOnly',
      q: (query as any).q,
    },
    { pagination: { offset: 0, limit: limit * 2 } },
  );

  // Merge results
  const allData = [...publicResult.data, ...memberOnlyResult.data];
  const totalCount = publicResult.totalCount + memberOnlyResult.totalCount;

  // Apply pagination to merged results
  const paginatedData = allData.slice(0, limit);
  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: paginatedData,
    pagination: {
      offset,
      limit,
      count: paginatedData.length,
      totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
