import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetCourseEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseEnrollmentRepository } from './repos/training.repo';

/**
 * getCourseEnrollment
 *
 * Path: GET /association/training/courses/enrollments/{enrollmentId}
 * OperationId: getCourseEnrollment
 */
export async function getCourseEnrollment(
  ctx: ValidatedContext<never, never, GetCourseEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseEnrollmentRepository(db, logger);

  const enrollment = await repo.findOneById(params.enrollmentId);
  if (!enrollment) throw new NotFoundError('Course enrollment not found');

  return ctx.json(enrollment, 200);
}
