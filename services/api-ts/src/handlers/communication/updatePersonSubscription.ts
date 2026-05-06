import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdatePersonSubscriptionBody, UpdatePersonSubscriptionParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { PersonSubscriptionRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * updatePersonSubscription
 *
 * Path: PATCH /association/person-subscriptions/{subscriptionId}
 * OperationId: updatePersonSubscription
 */
export async function updatePersonSubscription(
  ctx: ValidatedContext<UpdatePersonSubscriptionBody, never, UpdatePersonSubscriptionParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonSubscriptionRepository(db, logger);

  const existing = await repo.findById(params.subscriptionId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Person subscription not found');
  }

  const updated = await repo.update(params.subscriptionId, {
    enabled: body.enabled,
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'person-subscription',
    resourceId: params.subscriptionId,
    description: `Person subscription updated (enabled=${body.enabled})`,
  });

  return ctx.json(updated, 200);
}
