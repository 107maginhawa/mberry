import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateTrainingBody } from '@/generated/openapi/validators';
import { TrainingRepository } from './repos/training.repo';

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

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingRepository(db, logger);

  const training = await repo.createOne({
    // FIX-013 (F6): bind the training to the caller's resolved org context.
    // Never trust a body-supplied organizationId — accepting it would let an
    // officer create a training under a foreign org (org-isolation breach).
    organizationId: orgId,
    title: body.title,
    // FIX-007 (M9-R1): persist the platform training type (CPD reporting taxonomy).
    type: body.type,
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

  ctx.set('auditResourceId', training.id);
  ctx.set('auditDescription', 'Training created');

  return ctx.json(training, 201);
}
