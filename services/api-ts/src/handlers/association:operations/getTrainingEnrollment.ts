import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingEnrollmentRepository } from './repos/training.repo';

/**
 * getTrainingEnrollment
 *
 * Path: GET /association/training/enrollments/{enrollmentId}
 * OperationId: getTrainingEnrollment
 */
export async function getTrainingEnrollment(
  ctx: ValidatedContext<never, never, GetTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingEnrollmentRepository(db, logger);

  const enrollment = await repo.findOneById(params.enrollmentId);
  if (!enrollment) throw new NotFoundError('Training enrollment not found');

  return ctx.json(enrollment, 200);
}
