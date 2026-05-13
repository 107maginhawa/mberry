import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetSubscriptionTopicParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { SubscriptionTopicRepository } from './repos/communication.repo';

/**
 * getSubscriptionTopic
 *
 * Path: GET /association/subscription-topics/{topicId}
 * OperationId: getSubscriptionTopic
 */
export async function getSubscriptionTopic(
  ctx: ValidatedContext<never, never, GetSubscriptionTopicParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new SubscriptionTopicRepository(db, logger);

  const topic = await repo.findById(params.topicId);
  if (!topic || topic.organizationId !== orgId) {
    throw new NotFoundError('Subscription topic not found');
  }

  return ctx.json(topic, 200);
}
