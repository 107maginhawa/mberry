import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CheckInCustomTrainingQuery, CheckInCustomTrainingParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { awardTrainingCredit } from './utils/award-training-credit';
import { domainEvents } from '@/core/domain-events';

/**
 * checkInCustomTraining
 *
 * Path: POST /association/training-lifecycle/{trainingId}/check-in
 * OperationId: checkInCustomTraining
 *
 * G1 / FIX-001: Officer-confirmed attendance is the core CPD seam. When the
 * officer supplies `personId`, that enrolled member is marked present: their
 * enrollment is completed and a single AUTO CreditEntry is awarded to THEM
 * (not the officer), idempotently. Without `personId` the caller checks in
 * their own enrollment (legacy behaviour, no credit).
 */
export async function checkInCustomTraining(
  ctx: ValidatedContext<never, CheckInCustomTrainingQuery, CheckInCustomTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const trainingRepo = new TrainingRepository(db, logger);
  const enrollRepo = new TrainingEnrollmentRepository(db, logger);

  const training = await trainingRepo.findOneById(params.trainingId);
  if (!training) throw new NotFoundError('Training not found');

  // Officer marks a named enrollee present; otherwise the caller's own row.
  const targetPersonId = query.personId ?? user.id;

  const enrollments = await enrollRepo.findMany({ trainingId: params.trainingId, personId: targetPersonId });
  const enrollment = enrollments[0];
  if (!enrollment) {
    throw new BusinessLogicError('No enrollment found for this training', 'NOT_ENROLLED');
  }

  if (enrollment.status === 'cancelled') {
    throw new BusinessLogicError('Enrollment is cancelled', 'ENROLLMENT_CANCELLED');
  }

  // Persist attendance: an enrolled member becomes completed once marked
  // present. Already-completed enrollments stay completed (idempotent).
  if (enrollment.status === 'enrolled') {
    await enrollRepo.updateOneById(enrollment.id, {
      status: 'completed',
      completedAt: new Date(),
    } as Record<string, unknown>);
  }

  // [AC-M09-001] Award the AUTO credit to the attending member. The shared
  // routine is idempotent ([AC-M10-002]) and surfaces insert failures
  // (G8/FIX-002) rather than swallowing them.
  const { creditAwarded } = await awardTrainingCredit(db, logger, training, targetPersonId);

  // [WF-061 / BR-20] Emit training.completed so the certificate-available
  // consumer notifies this member their certificate can be downloaded.
  if (creditAwarded > 0 || enrollment.status === 'enrolled') {
    domainEvents
      .emit('training.completed', {
        trainingId: training.id,
        organizationId: training.organizationId,
        completedBy: user.id,
      })
      .catch(() => {});
  }

  ctx.set('auditResourceId', enrollment.id);
  ctx.set('auditDescription', 'Checked in for training session');
  ctx.set('auditDetails', { personId: targetPersonId, creditAwarded });

  return ctx.json({ ...enrollment, status: 'completed', creditAwarded }, 200);
}
