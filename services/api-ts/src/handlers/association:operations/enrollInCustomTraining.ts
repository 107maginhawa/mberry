import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { EnrollInCustomTrainingQuery, EnrollInCustomTrainingParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

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
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'training-enrollment',
    resourceId: enrollment.id,
    description: 'Enrolled in training',
  });

  return ctx.json(enrollment, 201);
}
