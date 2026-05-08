import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateCourseBody } from '@/generated/openapi/validators';
import { CourseRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

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

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CourseRepository(db, logger);

  const course = await repo.createOne({
    organizationId: orgId,
    title: (body as any).title,
    description: (body as any).description,
    creditAmount: (body as any).creditAmount,
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
