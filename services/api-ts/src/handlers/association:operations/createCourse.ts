import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateCourseBody } from '@/generated/openapi/validators';
import { CourseRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createCourse
 *
 * Path: POST /association/training/courses
 * OperationId: createCourse
 */
export async function createCourse(
  ctx: ValidatedContext<CreateCourseBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const course = await repo.createOne({
    organizationId: orgId,
    title: body.title,
    description: body.description,
    creditAmount: body.creditAmount,
    status: 'draft',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'course',
    resourceId: course.id,
    description: 'Course created',
  });

  return ctx.json(course, 201);
}
