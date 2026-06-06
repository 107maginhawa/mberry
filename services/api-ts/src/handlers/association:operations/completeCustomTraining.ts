import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CompleteCustomTrainingBody, CompleteCustomTrainingQuery, CompleteCustomTrainingParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * completeCustomTraining
 *
 * Path: POST /association/training-lifecycle/{trainingId}/complete
 * OperationId: completeCustomTraining
 */
export async function completeCustomTraining(
  ctx: ValidatedContext<CompleteCustomTrainingBody, CompleteCustomTrainingQuery, CompleteCustomTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const trainingRepo = new TrainingRepository(db, logger);
  const enrollRepo = new TrainingEnrollmentRepository(db, logger);

  const training = await trainingRepo.findOneById(params.trainingId);
  if (!training) throw new NotFoundError('Training not found');

  const enrollments = await enrollRepo.findMany({ trainingId: params.trainingId, personId: user.id });
  const enrollment = enrollments[0];
  if (!enrollment) {
    throw new BusinessLogicError('No enrollment found for this training', 'NOT_ENROLLED');
  }

  if (enrollment.status === 'cancelled') {
    throw new BusinessLogicError('Cannot complete a cancelled enrollment', 'ENROLLMENT_CANCELLED');
  }

  if (enrollment.status === 'completed') {
    throw new BusinessLogicError('Enrollment is already completed', 'ALREADY_COMPLETED');
  }

  const updated = await enrollRepo.updateOneById(enrollment.id, {
    status: 'completed',
    completedAt: new Date(),
  });

  domainEvents.emit('training.completed', {
    trainingId: training.id,
    organizationId: training.organizationId,
    completedBy: user.id,
  }).catch(() => {});

  ctx.set('auditResourceId', enrollment.id);
  ctx.set('auditDescription', 'Training enrollment marked as completed');

  return ctx.json(updated, 200);
}
