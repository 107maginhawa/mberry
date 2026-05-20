import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchCoursesQuery } from '@/generated/openapi/validators';
import { CourseRepository } from './repos/training.repo';

/**
 * searchCourses
 *
 * Path: GET /association/training/courses
 * OperationId: searchCourses
 */
export async function searchCourses(
  ctx: ValidatedContext<never, SearchCoursesQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const limit = Number(query.limit) || 20;
  const offset = Number(query.offset) || 0;

  const filters: Record<string, unknown> = { organizationId: orgId };
  if (query.status) filters.status = query.status;

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
