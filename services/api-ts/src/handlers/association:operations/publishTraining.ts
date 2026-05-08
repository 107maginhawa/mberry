import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { PublishTrainingParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

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

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const existing = await repo.findOneById((params as any).trainingId);
  if (!existing) throw new NotFoundError('Training not found');

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft trainings can be published', 'INVALID_STATUS');
  }

  const published = await repo.publish((params as any).trainingId);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'training',
    resourceId: published.id,
    description: 'Training published',
  });

  return ctx.json(published, 200);
}
