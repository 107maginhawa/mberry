import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateTrainingEnrollmentBody, UpdateTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
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

  const existing = await repo.findOneById(params.enrollmentId);
  if (!existing) throw new NotFoundError('Training enrollment not found');

  // BR-43: completed training locks enrollments — no changes post-completion.
  const training = await new TrainingRepository(db, logger).findOneById(existing.trainingId);
  if (training?.status === 'completed') {
    throw new BusinessLogicError(
      'This training is completed. Enrollments are locked and cannot be changed.',
      'TRAINING_COMPLETED',
    );
  }

  const updated = await repo.updateOneById(params.enrollmentId, body as Record<string, unknown>);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'training-enrollment',
    resourceId: updated.id,
    description: 'Training enrollment updated',
  });

  return ctx.json(updated, 200);
}
