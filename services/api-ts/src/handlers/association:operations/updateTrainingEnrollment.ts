import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateTrainingEnrollmentBody, UpdateTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * updateTrainingEnrollment
 *
 * Path: PATCH /association/training/enrollments/{enrollmentId}
 * OperationId: updateTrainingEnrollment
 */
export async function updateTrainingEnrollment(
  ctx: ValidatedContext<UpdateTrainingEnrollmentBody, never, UpdateTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingEnrollmentRepository(db, logger);

  const existing = await repo.findOneById((params as any).enrollmentId);
  if (!existing) throw new NotFoundError('Training enrollment not found');

  const updated = await repo.updateOneById((params as any).enrollmentId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'training-enrollment',
    resourceId: updated.id,
    description: 'Training enrollment updated',
  });

  return ctx.json(updated, 200);
}
