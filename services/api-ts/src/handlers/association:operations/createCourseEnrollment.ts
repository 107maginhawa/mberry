import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateCourseEnrollmentBody } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository, CourseEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

/**
 * createCourseEnrollment
 *
 * Path: POST /association/training/courses/enrollments
 * OperationId: createCourseEnrollment
 */
export async function createCourseEnrollment(
  ctx: ValidatedContext<CreateCourseEnrollmentBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const courseRepo = new CourseRepository(db, logger);
  const enrollRepo = new CourseEnrollmentRepository(db, logger);

  const courseId = (body as any).courseId;
  const personId = (body as any).personId || user.id;

  const course = await courseRepo.findOneById(courseId);
  if (!course) throw new NotFoundError('Course not found');

  const enrollment = await enrollRepo.createOne({
    courseId,
    personId,
    progress: 0,
    status: 'enrolled',
    organizationId: orgId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'course-enrollment',
    resourceId: enrollment.id,
    description: 'Course enrollment created',
  });

  return ctx.json(enrollment, 201);
}
