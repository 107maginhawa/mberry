import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetTrainingParams } from '@/generated/openapi/validators';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

/**
 * getTraining
 *
 * Path: GET /association/training/{trainingId}
 * OperationId: getTraining
 */
export async function getTraining(
  ctx: ValidatedContext<never, never, GetTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError('Organization context required');

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  // Scoped query: fetch only within caller's org (prevents cross-org data leak)
  const training = await repo.findOne({ id: params.trainingId, organizationId: orgId });
  if (!training) throw new NotFoundError('Training not found');

  return ctx.json(training, 200);
}
