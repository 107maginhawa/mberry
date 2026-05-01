import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetCourseParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository } from './repos/training.repo';

/**
 * getCourse
 *
 * Path: GET /association/training/courses/{courseId}
 * OperationId: getCourse
 */
export async function getCourse(
  ctx: ValidatedContext<never, never, GetCourseParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const course = await repo.findOneById((params as any).courseId);
  if (!course) throw new NotFoundError('Course not found');

  return ctx.json(course, 200);
}
