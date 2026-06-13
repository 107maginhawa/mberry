import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateTrainingEnrollmentBody } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';

/**
 * createTrainingEnrollment
 *
 * Path: POST /association/training/enrollments
 * OperationId: createTrainingEnrollment
 *
 * BR-41 (M9-R2): Paid training requires payment before enrollment
 */
export async function createTrainingEnrollment(
  ctx: ValidatedContext<CreateTrainingEnrollmentBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const trainingRepo = new TrainingRepository(db, logger);
  const enrollRepo = new TrainingEnrollmentRepository(db, logger);

  const trainingId = body.trainingId;
  const personId = body.personId || user.id;

  const training = await trainingRepo.findOneById(trainingId);
  if (!training) throw new NotFoundError('Training not found');

  if (training.status !== 'published') {
    throw new BusinessLogicError('Enrollment is only accepted for published trainings', 'TRAINING_NOT_PUBLISHED');
  }

  // BR-41 / TC-DEC-01 (Step 47): paid trainings use the proof-of-payment flow
  // instead of a hard PAYMENT_REQUIRED dead-end. A paid enrollment is created
  // in `payment_pending`; the member submits proof and an officer confirms
  // (confirmTrainingPayment) before it becomes `enrolled`. The credit-award
  // path (completeTrainingEnrollment) only accepts `enrolled → completed`, so
  // no credit can be awarded while payment is unconfirmed.
  const isPaid = !!(training.registrationFee && training.registrationFee > 0);
  const initialStatus = isPaid ? 'payment_pending' : 'enrolled';

  if (training.capacity) {
    const enrolledCount = await enrollRepo.count({ trainingId, status: 'enrolled' });
    if (enrolledCount >= training.capacity) {
      throw new BusinessLogicError('Training is at full capacity', 'CAPACITY_FULL');
    }
  }

  const enrollment = await enrollRepo.createOne({
    trainingId,
    personId,
    status: initialStatus,
    organizationId: orgId,
  });

  ctx.set('auditResourceId', enrollment.id);
  ctx.set('auditDescription', 'Training enrollment created');

  return ctx.json(enrollment, 201);
}
