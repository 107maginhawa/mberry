import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateTrainingBody, UpdateTrainingParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * updateTraining
 *
 * Path: PATCH /association/training/{trainingId}
 * OperationId: updateTraining
 */
export async function updateTraining(
  ctx: ValidatedContext<UpdateTrainingBody, never, UpdateTrainingParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const existing = await repo.findOneById(params.trainingId);
  if (!existing) throw new NotFoundError('Training not found');

  const updates: Record<string, unknown> = { ...body };

  const updated = await repo.updateOneById(params.trainingId, updates);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'training',
    resourceId: updated.id,
    description: 'Training updated',
  });

  return ctx.json(updated, 200);
}
