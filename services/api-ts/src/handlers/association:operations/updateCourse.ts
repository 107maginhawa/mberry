import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCourseBody, UpdateCourseParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { CourseRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

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

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const existing = await repo.findOneById((params as any).courseId);
  if (!existing) throw new NotFoundError('Course not found');

  const updated = await repo.updateOneById((params as any).courseId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'course',
    resourceId: updated.id,
    description: 'Course updated',
  });

  return ctx.json(updated, 200);
}
