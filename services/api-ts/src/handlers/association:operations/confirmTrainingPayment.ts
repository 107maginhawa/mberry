import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { ConfirmTrainingPaymentQuery, ConfirmTrainingPaymentParams } from '@/generated/openapi/validators';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { assertValidTransition, TRAINING_ENROLLMENT_VALID_TRANSITIONS } from '@/utils/status-transitions';

/**
 * confirmTrainingPayment
 *
 * Path: POST /association/training-lifecycle/enrollments/{enrollmentId}/confirm-payment
 * OperationId: confirmTrainingPayment
 *
 * TC-DEC-01 (Step 47) proof-of-payment: an officer (x-require-position enforced
 * by middleware) confirms offline payment for a payment_pending enrollment,
 * moving it to `enrolled`. Only then can the enrollment be completed for credit
 * (completeTrainingEnrollment accepts only enrolled → completed). The FSM guard
 * rejects confirming an enrollment that is not payment_pending (409).
 */
export async function confirmTrainingPayment(
  ctx: ValidatedContext<never, ConfirmTrainingPaymentQuery, ConfirmTrainingPaymentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const enrollRepo = new TrainingEnrollmentRepository(db, logger);
  const enrollment = await enrollRepo.findOneById(params.enrollmentId);
  if (!enrollment) throw new NotFoundError('Training enrollment not found');

  // FSM guard — only payment_pending → enrolled is a valid confirmation.
  // A non-paid (already enrolled) or terminal enrollment raises ConflictError.
  assertValidTransition(
    TRAINING_ENROLLMENT_VALID_TRANSITIONS,
    enrollment.status,
    'enrolled',
    'training enrollment',
  );

  const updated = await enrollRepo.updateOneById(enrollment.id, {
    status: 'enrolled',
    paymentConfirmedBy: user.id,
    paymentConfirmedAt: new Date(),
  } as Record<string, unknown>);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Training payment confirmed by officer');

  return ctx.json(updated, 200);
}
