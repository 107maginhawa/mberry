import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCourseEnrollmentBody, UpdateCourseEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * updateCourseEnrollment
 *
 * Path: PATCH /association/training/courses/enrollments/{enrollmentId}
 * OperationId: updateCourseEnrollment
 */
export async function updateCourseEnrollment(
  ctx: ValidatedContext<UpdateCourseEnrollmentBody, never, UpdateCourseEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseEnrollmentRepository(db, logger);

  const existing = await repo.findOneById(params.enrollmentId);
  if (!existing) throw new NotFoundError('Course enrollment not found');

  const updated = await repo.updateOneById(params.enrollmentId, body as Record<string, unknown>);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Course enrollment updated');

  return ctx.json(updated, 200);
}
