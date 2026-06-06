import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteTrainingEnrollment
 *
 * Path: DELETE /association/training/enrollments/{enrollmentId}
 * OperationId: deleteTrainingEnrollment
 */
export async function deleteTrainingEnrollment(
  ctx: ValidatedContext<never, never, DeleteTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingEnrollmentRepository(db, logger);

  const existing = await repo.findOneById(params.enrollmentId);
  if (!existing) throw new NotFoundError('Training enrollment not found');

  // BR-43: completed training locks enrollments — no changes post-completion.
  const training = await new TrainingRepository(db, logger).findOneById(existing.trainingId);
  if (training?.status === 'completed') {
    throw new BusinessLogicError(
      'This training is completed. Enrollments are locked and cannot be removed.',
      'TRAINING_COMPLETED',
    );
  }

  await repo.deleteOneById(params.enrollmentId, user.id);

  ctx.set('auditResourceId', params.enrollmentId);
  ctx.set('auditDescription', 'Training enrollment deleted');

  return ctx.json({ success: true }, 200);
}
