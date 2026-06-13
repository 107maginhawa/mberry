import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import type {
  SubmitTrainingPaymentProofBody,
  SubmitTrainingPaymentProofQuery,
  SubmitTrainingPaymentProofParams,
} from '@/generated/openapi/validators';
import { TrainingEnrollmentRepository } from './repos/training.repo';

/**
 * submitTrainingPaymentProof
 *
 * Path: POST /association/training-lifecycle/enrollments/{enrollmentId}/payment-proof
 * OperationId: submitTrainingPaymentProof
 *
 * TC-DEC-01 (Step 47) proof-of-payment: a member attaches offline-payment
 * proof to their OWN payment_pending enrollment. This records the proof for
 * officer review; it does NOT by itself unlock the enrollment — an officer
 * must call confirmTrainingPayment to move it to `enrolled`.
 */
export async function submitTrainingPaymentProof(
  ctx: ValidatedContext<SubmitTrainingPaymentProofBody, SubmitTrainingPaymentProofQuery, SubmitTrainingPaymentProofParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const enrollRepo = new TrainingEnrollmentRepository(db, logger);
  const enrollment = await enrollRepo.findOneById(params.enrollmentId);
  if (!enrollment) throw new NotFoundError('Training enrollment not found');

  // A member may only submit proof for their own enrollment.
  if (enrollment.personId !== user.id) {
    throw new ForbiddenError('You can only submit payment proof for your own enrollment');
  }

  // Proof only makes sense while payment is unconfirmed.
  if (enrollment.status !== 'payment_pending') {
    throw new BusinessLogicError(
      'Payment proof can only be submitted while the enrollment is awaiting payment confirmation',
      'PAYMENT_NOT_PENDING',
    );
  }

  const updated = await enrollRepo.updateOneById(enrollment.id, {
    proofStorageKey: body.proofStorageKey,
    proofFileName: body.proofFileName ?? null,
    proofMimeType: body.proofMimeType ?? null,
    paymentSubmittedAt: new Date(),
  } as Record<string, unknown>);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Training payment proof submitted');

  return ctx.json(updated, 200);
}
