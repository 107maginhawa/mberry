import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCourseBody, UpdateCourseParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository } from './repos/training.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * updateCourse
 *
 * Path: PATCH /association/training/courses/{courseId}
 * OperationId: updateCourse
 */
export async function updateCourse(
  ctx: ValidatedContext<UpdateCourseBody, never, UpdateCourseParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const existing = await repo.findOneById(params.courseId);
  if (!existing) throw new NotFoundError('Course not found');

  const updated = await repo.updateOneById(params.courseId, body as Record<string, unknown>);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Course updated');

  return ctx.json(updated, 200);
}
