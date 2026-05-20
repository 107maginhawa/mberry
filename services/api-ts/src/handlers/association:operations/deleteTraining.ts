import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteTrainingParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteTraining
 *
 * Path: DELETE /association/training/{trainingId}
 * OperationId: deleteTraining
 */
export async function deleteTraining(
  ctx: ValidatedContext<never, never, DeleteTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const existing = await repo.findOneById(params.trainingId);
  if (!existing) throw new NotFoundError('Training not found');

  await repo.deleteOneById(params.trainingId, user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'training',
    resourceId: params.trainingId,
    description: 'Training deleted',
  });

  return ctx.json({ success: true }, 200);
}
