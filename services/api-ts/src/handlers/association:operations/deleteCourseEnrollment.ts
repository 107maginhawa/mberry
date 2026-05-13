import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteCourseEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteCourseEnrollment
 *
 * Path: DELETE /association/training/courses/enrollments/{enrollmentId}
 * OperationId: deleteCourseEnrollment
 */
export async function deleteCourseEnrollment(
  ctx: ValidatedContext<never, never, DeleteCourseEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseEnrollmentRepository(db, logger);

  const existing = await repo.findOneById((params as any).enrollmentId);
  if (!existing) throw new NotFoundError('Course enrollment not found');

  await repo.deleteOneById((params as any).enrollmentId, user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'course-enrollment',
    resourceId: (params as any).enrollmentId,
    description: 'Course enrollment deleted',
  });

  return ctx.json({ success: true }, 200);
}
