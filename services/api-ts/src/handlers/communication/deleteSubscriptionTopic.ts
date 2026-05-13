import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteSubscriptionTopicParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { SubscriptionTopicRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteSubscriptionTopic
 *
 * Path: DELETE /association/subscription-topics/{topicId}
 * OperationId: deleteSubscriptionTopic
 */
export async function deleteSubscriptionTopic(
  ctx: ValidatedContext<never, never, DeleteSubscriptionTopicParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new SubscriptionTopicRepository(db, logger);

  const existing = await repo.findById(params.topicId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Subscription topic not found');
  }

  await repo.delete(params.topicId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'subscription-topic',
    resourceId: params.topicId,
    description: `Subscription topic "${existing.name}" deleted`,
  });

  return ctx.body(null, 204);
}
