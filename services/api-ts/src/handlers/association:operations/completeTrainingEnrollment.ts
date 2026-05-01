import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CompleteTrainingEnrollmentBody, CompleteTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingEnrollmentRepository, TrainingRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

/**
 * completeTrainingEnrollment
 *
 * Path: POST /association/training/enrollments/{enrollmentId}/complete
 * OperationId: completeTrainingEnrollment
 *
 * Business rules:
 * - Set completedAt, status to completed
 * - Auto-credit if the training is creditBearing
 */
export async function completeTrainingEnrollment(
  ctx: ValidatedContext<CompleteTrainingEnrollmentBody, never, CompleteTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const enrollRepo = new TrainingEnrollmentRepository(db, logger);
  const trainingRepo = new TrainingRepository(db, logger);

  const enrollment = await enrollRepo.findOneById((params as any).enrollmentId);
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
  } as any);

  const training = await trainingRepo.findOneById(enrollment.trainingId);
  const creditAwarded = training?.creditBearing ? training.creditAmount : 0;

  await auditAction(ctx, {
    action: 'complete',
    resourceType: 'training-enrollment',
    resourceId: completed.id,
    description: 'Training enrollment completed',
    details: creditAwarded ? { creditAwarded } : undefined,
  });

  return ctx.json({ ...completed, creditAwarded }, 200);
}
