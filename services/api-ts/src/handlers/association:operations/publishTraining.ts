import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { PublishTrainingParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { assertValidTransition, TRAINING_VALID_TRANSITIONS } from '@/utils/status-transitions';

/**
 * publishTraining
 *
 * Path: POST /association/training/{trainingId}/publish
 * OperationId: publishTraining
 */
export async function publishTraining(
  ctx: ValidatedContext<never, never, PublishTrainingParams>
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

  assertValidTransition(TRAINING_VALID_TRANSITIONS, existing.status, 'published', 'training');

  const published = await repo.publish(params.trainingId);

  domainEvents.emit('training.published', {
    trainingId: published.id,
    organizationId: published.organizationId,
    publishedBy: user.id,
  }).catch(() => {});

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'training',
    resourceId: published.id,
    description: 'Training published',
  });

  return ctx.json(published, 200);
}
