import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CheckInCustomTrainingQuery, CheckInCustomTrainingParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * checkInCustomTraining
 *
 * Path: POST /association/training-lifecycle/{trainingId}/check-in
 * OperationId: checkInCustomTraining
 */
export async function checkInCustomTraining(
  ctx: ValidatedContext<never, CheckInCustomTrainingQuery, CheckInCustomTrainingParams>
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
    throw new BusinessLogicError('Enrollment is cancelled', 'ENROLLMENT_CANCELLED');
  }

  ctx.set('auditResourceId', enrollment.id);
  ctx.set('auditDescription', 'Checked in for training session');

  return ctx.json(enrollment, 200);
}
