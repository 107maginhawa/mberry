import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteCourseParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository } from './repos/training.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteCourse
 *
 * Path: DELETE /association/training/courses/{courseId}
 * OperationId: deleteCourse
 */
export async function deleteCourse(
  ctx: ValidatedContext<never, never, DeleteCourseParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const existing = await repo.findOneById(params.courseId);
  if (!existing) throw new NotFoundError('Course not found');

  await repo.deleteOneById(params.courseId, user.id);

  ctx.set('auditResourceId', params.courseId);
  ctx.set('auditDescription', 'Course deleted');

  return ctx.json({ success: true }, 200);
}
