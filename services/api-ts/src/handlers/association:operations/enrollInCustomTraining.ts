import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { EnrollInCustomTrainingQuery, EnrollInCustomTrainingParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';

/**
 * enrollInCustomTraining
 *
 * Path: POST /association/training-lifecycle/{trainingId}/enroll
 * OperationId: enrollInCustomTraining
 */
export async function enrollInCustomTraining(
  ctx: ValidatedContext<never, EnrollInCustomTrainingQuery, EnrollInCustomTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const trainingRepo = new TrainingRepository(db, logger);
  const enrollRepo = new TrainingEnrollmentRepository(db, logger);

  const training = await trainingRepo.findOneById(params.trainingId);
  if (!training) throw new NotFoundError('Training not found');

  if (training.status !== 'published') {
    throw new BusinessLogicError('Enrollment is only accepted for published trainings', 'TRAINING_NOT_PUBLISHED');
  }

  // FIX-010 (G10): a member may hold at most one active enrollment per
  // training. Reject a second enroll attempt for the same (trainingId,
  // personId) — a duplicate row distorts capacity counting and makes
  // `enrollments[0]` selection arbitrary at check-in. (A previously
  // cancelled enrollment does not block re-enrollment.) The DB also carries
  // a partial unique index as the backstop for races.
  const existingEnrollments = await enrollRepo.findMany({ trainingId: params.trainingId, personId: user.id });
  if (existingEnrollments.some((e) => e.status !== 'cancelled')) {
    throw new BusinessLogicError('Already enrolled in this training', 'ALREADY_ENROLLED');
  }

  // BR-41: paid training requires confirmed payment before enrollment.
  if (training.registrationFee && training.registrationFee > 0) {
    throw new BusinessLogicError(
      'This training requires payment. Complete payment before enrolling.',
      'PAYMENT_REQUIRED',
    );
  }

  if (training.capacity) {
    const enrolledCount = await enrollRepo.count({ trainingId: params.trainingId, status: 'enrolled' });
    if (enrolledCount >= training.capacity) {
      throw new BusinessLogicError('Training is at full capacity', 'CAPACITY_FULL');
    }
  }

  const enrollment = await enrollRepo.createOne({
    trainingId: params.trainingId,
    personId: user.id,
    status: 'enrolled',
    organizationId: orgId,
  });

  ctx.set('auditResourceId', enrollment.id);
  ctx.set('auditDescription', 'Enrolled in training');

  return ctx.json(enrollment, 201);
}
