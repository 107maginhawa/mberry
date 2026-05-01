import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCourseProgressBody, UpdateCourseProgressParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateCourseProgress
 *
 * Path: POST /association/training/courses/enrollments/{enrollmentId}/progress
 * OperationId: updateCourseProgress
 */
export async function updateCourseProgress(
  ctx: ValidatedContext<UpdateCourseProgressBody, never, UpdateCourseProgressParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseEnrollmentRepository(db, logger);

  const enrollment = await repo.findOneById((params as any).enrollmentId);
  if (!enrollment) throw new NotFoundError('Course enrollment not found');

  if (enrollment.status !== 'enrolled') {
    throw new BusinessLogicError('Progress can only be updated for enrolled enrollments', 'INVALID_STATUS');
  }

  const progress = (body as any).progress;
  const updates: any = { progress };

  // Auto-complete when progress reaches 100%
  if (progress >= 100) {
    updates.completedAt = new Date();
    updates.status = 'completed';
    updates.progress = 100;
  }

  const updated = await repo.updateOneById(enrollment.id, updates);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'course-enrollment',
    resourceId: updated.id,
    description: `Course progress updated to ${updates.progress}%`,
  });

  return ctx.json(updated, 200);
}
