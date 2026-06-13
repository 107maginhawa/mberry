import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CancelCustomTrainingQuery, CancelCustomTrainingParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * cancelCustomTraining
 *
 * Path: POST /association/training-lifecycle/{trainingId}/cancel
 * OperationId: cancelCustomTraining
 */
export async function cancelCustomTraining(
  ctx: ValidatedContext<never, CancelCustomTrainingQuery, CancelCustomTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

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
    throw new BusinessLogicError('Enrollment is already cancelled', 'ALREADY_CANCELLED');
  }

  if (enrollment.status === 'completed') {
    throw new BusinessLogicError('Cannot cancel a completed enrollment', 'ALREADY_COMPLETED');
  }

  const updated = await enrollRepo.updateOneById(enrollment.id, {
    status: 'cancelled',
    cancelledAt: new Date(),
  });

  // FIX-003 / G6: this cancels ONE enrollment, not the whole training program.
  // Emit the enrollment-scoped event so the program-wide `training.cancelled`
  // consumer does not mass-notify every enrollee. [CROSS-MODULE RISK]
  domainEvents.emit('training.enrollment.cancelled', {
    enrollmentId: enrollment.id,
    trainingId: training.id,
    organizationId: training.organizationId,
    personId: enrollment.personId,
    cancelledBy: user.id,
  }).catch(() => {});

  ctx.set('auditResourceId', enrollment.id);
  ctx.set('auditDescription', 'Training enrollment cancelled');

  return ctx.json(updated, 200);
}
