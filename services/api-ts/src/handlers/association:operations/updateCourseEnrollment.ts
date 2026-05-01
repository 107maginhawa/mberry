import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCourseEnrollmentBody, UpdateCourseEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

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

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseEnrollmentRepository(db, logger);

  const existing = await repo.findOneById((params as any).enrollmentId);
  if (!existing) throw new NotFoundError('Course enrollment not found');

  const updated = await repo.updateOneById((params as any).enrollmentId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'course-enrollment',
    resourceId: updated.id,
    description: 'Course enrollment updated',
  });

  return ctx.json(updated, 200);
}
