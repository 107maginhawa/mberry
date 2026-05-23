import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetTrainingParams } from '@/generated/openapi/validators';
import { ForbiddenError, NotFoundError } from '@/core/errors';
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
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const training = await repo.findOneById(params.trainingId);
  if (!training) throw new NotFoundError('Training not found');

  // Prevent cross-org data leak: verify training belongs to caller's org
  if (training.organizationId !== orgId) {
    throw new ForbiddenError('Training not found in this organization');
  }

  return ctx.json(training, 200);
}
