import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CompleteTrainingEnrollmentBody, CompleteTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingEnrollmentRepository, TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { getCycleForDate } from '../association:member/utils/credit-cycle';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * completeTrainingEnrollment
 *
 * Path: POST /association/training/enrollments/{enrollmentId}/complete
 *
 * BR-43 (M9-R3): Completed training locks further enrollment changes
 * BR-44 (M9-R7): Idempotent attendance — no duplicate credits awarded
 * OperationId: completeTrainingEnrollment
 *
 * Business rules:
 * - Set completedAt, status to completed
 * - [AC-M09-001] Auto-credit if the training is creditBearing
 * - [AC-M10-002] No duplicate AUTO credits for same training+person
 */
export async function completeTrainingEnrollment(
  ctx: ValidatedContext<CompleteTrainingEnrollmentBody, never, CompleteTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const enrollRepo = new TrainingEnrollmentRepository(db, logger);
  const trainingRepo = new TrainingRepository(db, logger);

  const enrollment = await enrollRepo.findOneById(params.enrollmentId);
  if (!enrollment) throw new NotFoundError('Training enrollment not found');

  if (enrollment.status === 'completed') {
    throw new BusinessLogicError('Enrollment is already completed', 'ALREADY_COMPLETED');
  }

  if (enrollment.status !== 'enrolled') {
    throw new BusinessLogicError('Only enrolled enrollments can be completed', 'INVALID_STATUS');
  }

  const completed = await enrollRepo.updateOneById(enrollment.id, {
    status: 'completed',
    completedAt: new Date(),
  } as Record<string, unknown>);

  const training = await trainingRepo.findOneById(enrollment.trainingId);
  let creditAwarded = 0;

  // [AC-M09-001] Auto-create credit entry for credit-bearing trainings
  // [AC-M10-002] Duplicate guard via findByTrainingAndPerson
  if (training?.creditBearing && training.creditAmount && training.creditAmount > 0) {
    creditAwarded = training.creditAmount;
    try {
      const creditRepo = new CreditEntryRepository(db, logger);
      const existing = await creditRepo.findByTrainingAndPerson(training.id, enrollment.personId);

      if (!existing) {
        const activityDate = training.endDate ?? new Date();
        const cycle = getCycleForDate(activityDate, activityDate, 2);

        await creditRepo.createOne({
          personId: enrollment.personId,
          organizationId: training.organizationId,
          type: 'auto',
          trainingId: training.id,
          activityName: training.title,
          provider: training.organizationId,
          activityDate,
          creditAmount: training.creditAmount,
          cycleStart: cycle.cycleStart,
          cycleEnd: cycle.cycleEnd,
        });
      }
    } catch {
      // Credit creation failure should not block enrollment completion
    }
  }

  // [WF-061 / BR-20] Connect certificate generation to completion: emit
  // training.completed so the cert-available consumer (EM-M11-e2f45a01)
  // notifies the member their certificate can be downloaded.
  if (training) {
    domainEvents
      .emit('training.completed', {
        trainingId: training.id,
        organizationId: training.organizationId,
        completedBy: user.id,
      })
      .catch(() => {});
  }

  await auditAction(ctx, {
    action: 'complete',
    resourceType: 'training-enrollment',
    resourceId: completed.id,
    description: 'Training enrollment completed',
    details: creditAwarded ? { creditAwarded } : undefined,
    eventSubType: 'training.training-completed',
  });

  return ctx.json({ ...completed, creditAwarded }, 200);
}
