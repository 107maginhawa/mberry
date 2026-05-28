import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListDirectoryProfilesQuery } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DirectoryProfileRepository } from './repos/directory.repo';

/**
 * listDirectoryProfiles
 *
 * Path: GET /association/member/directory/profiles
 * OperationId: listDirectoryProfiles
 */
export async function listDirectoryProfiles(
  ctx: ValidatedContext<never, ListDirectoryProfilesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // EF-M04: Verify caller is a member of the org whose directory they're listing
  const orgMembership = ctx.get('orgMembership');
  if (!orgMembership) {
    return ctx.json({ error: 'Organization membership required' }, 403);
  }

  const orgId = ctx.get('organizationId');
  const query = ctx.req.valid('query');
  const visibility = (query as Record<string, unknown>)['visibility'] as 'public' | 'memberOnly' | 'hidden' | undefined;
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DirectoryProfileRepository(db, ctx.get('logger'));

  const result = await repo.findManyWithPagination(
    {
      organizationId: orgId,
      visibility,
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
