import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateSubscriptionTopicBody } from '@/generated/openapi/validators';
import { SubscriptionTopicRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * createSubscriptionTopic
 *
 * Path: POST /association/subscription-topics
 * OperationId: createSubscriptionTopic
 */
export async function createSubscriptionTopic(
  ctx: ValidatedContext<CreateSubscriptionTopicBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new SubscriptionTopicRepository(db, logger);

  const topic = await repo.create({
    organizationId: orgId,
    name: body.name,
    description: body.description ?? null,
    channel: body.channel,
    category: body.category,
    defaultEnabled: body.defaultEnabled,
    createdBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'subscription-topic',
    resourceId: topic.id,
    description: `Subscription topic "${body.name}" created`,
  });

  return ctx.json(topic, 201);
}
