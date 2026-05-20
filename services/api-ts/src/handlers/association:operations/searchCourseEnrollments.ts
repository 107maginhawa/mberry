import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchCourseEnrollmentsQuery } from '@/generated/openapi/validators';
import { CourseEnrollmentRepository } from './repos/training.repo';

/**
 * searchCourseEnrollments
 *
 * Path: GET /association/training/courses/enrollments
 * OperationId: searchCourseEnrollments
 */
export async function searchCourseEnrollments(
  ctx: ValidatedContext<never, SearchCourseEnrollmentsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseEnrollmentRepository(db, logger);

  const limit = Number(query.limit) || 20;
  const offset = Number(query.offset) || 0;

  const filters: Record<string, unknown> = {};
  const q = query as Record<string, unknown>;
  if (q['courseId']) filters['courseId'] = q['courseId'];
  if (q['personId']) filters['personId'] = q['personId'];
  if (q['status']) filters['status'] = q['status'];

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
