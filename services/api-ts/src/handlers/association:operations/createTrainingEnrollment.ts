import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateTrainingEnrollmentBody } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

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

  if (training.capacity) {
    const enrolledCount = await enrollRepo.count({ trainingId, status: 'enrolled' });
    if (enrolledCount >= training.capacity) {
      throw new BusinessLogicError('Training is at full capacity', 'CAPACITY_FULL');
    }
  }

  const enrollment = await enrollRepo.createOne({
    trainingId,
    personId,
    status: 'enrolled',
    organizationId: orgId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'training-enrollment',
    resourceId: enrollment.id,
    description: 'Training enrollment created',
    eventSubType: 'training.enrollment-created',
  });

  return ctx.json(enrollment, 201);
}
