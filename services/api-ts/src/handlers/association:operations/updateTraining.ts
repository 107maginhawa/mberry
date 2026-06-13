import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateTrainingBody, UpdateTrainingParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

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

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const existing = await repo.findOneById(params.trainingId);
  if (!existing) throw new NotFoundError('Training not found');

  const updates: Record<string, unknown> = { ...body };

  // FIX-008 (M9-R2): the lifecycle `status` is not part of the TypeSpec update
  // contract; defensively strip it so a loose body cannot mutate it (status
  // transitions go through publish/cancel/complete, not updateTraining).
  delete updates['status'];

  // FIX-008 (M9-R2): once any AUTO credit has been awarded for this training,
  // `creditAmount` is locked — changing it would corrupt already-issued credit
  // history. Allow an identical (no-op) value through.
  const wantsCreditChange =
    'creditAmount' in body &&
    body.creditAmount !== undefined &&
    body.creditAmount !== (existing as { creditAmount?: number }).creditAmount;

  if (wantsCreditChange) {
    const creditRepo = new CreditEntryRepository(db, logger);
    const awardedCount = await creditRepo.countAutoByTraining(params.trainingId);
    if (awardedCount > 0) {
      return ctx.json(
        {
          error: 'Credit amount is locked once a training has awarded credits',
          code: 'CREDIT_AMOUNT_LOCKED',
        },
        409,
      );
    }
  }

  const updated = await repo.updateOneById(params.trainingId, updates);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Training updated');

  return ctx.json(updated, 200);
}
