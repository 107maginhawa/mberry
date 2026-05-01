import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteCourseParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

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

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const existing = await repo.findOneById((params as any).courseId);
  if (!existing) throw new NotFoundError('Course not found');

  await repo.deleteOneById((params as any).courseId, user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'course',
    resourceId: (params as any).courseId,
    description: 'Course deleted',
  });

  return ctx.json({ success: true }, 200);
}
