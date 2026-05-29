import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateTrainingBody } from '@/generated/openapi/validators';
import { TrainingRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createTraining
 *
 * Path: POST /association/training
 * OperationId: createTraining
 *
 * BR-42 (M9-R1): Training type restricted to platform-defined types
 */
export async function createTraining(
  ctx: ValidatedContext<CreateTrainingBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const training = await repo.createOne({
    organizationId: body.organizationId || orgId,
    title: body.title,
    description: body.description,
    instructorName: body.instructor,
    location: body.location,
    startDate: body.startDate, // Zod already transforms to Date
    endDate: body.endDate!,
    capacity: body.capacity,
    registrationFee: body.registrationFee,
    creditAmount: body.creditAmount,
    status: 'draft',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'training',
    resourceId: training.id,
    description: 'Training created',
    eventSubType: 'training.training-created',
  });

  return ctx.json(training, 201);
}
