import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateSubscriptionTopicBody, UpdateSubscriptionTopicParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { SubscriptionTopicRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateSubscriptionTopic
 *
 * Path: PATCH /association/subscription-topics/{topicId}
 * OperationId: updateSubscriptionTopic
 */
export async function updateSubscriptionTopic(
  ctx: ValidatedContext<UpdateSubscriptionTopicBody, never, UpdateSubscriptionTopicParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new SubscriptionTopicRepository(db, logger);

  const existing = await repo.findById(params.topicId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Subscription topic not found');
  }

  const updated = await repo.update(params.topicId, {
    ...body,
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'subscription-topic',
    resourceId: params.topicId,
    description: `Subscription topic "${existing.name}" updated`,
  });

  return ctx.json(updated, 200);
}
