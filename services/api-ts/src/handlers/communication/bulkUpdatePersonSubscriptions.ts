import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { BulkUpdatePersonSubscriptionsBody } from '@/generated/openapi/validators';
import { PersonSubscriptionRepository } from './repos/communication.repo';

/**
 * bulkUpdatePersonSubscriptions
 *
 * Path: POST /association/person-subscriptions/bulk-update
 * OperationId: bulkUpdatePersonSubscriptions
 *
 * Accepts an array of {topicId, enabled} and upserts each.
 */
export async function bulkUpdatePersonSubscriptions(
  ctx: ValidatedContext<BulkUpdatePersonSubscriptionsBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonSubscriptionRepository(db, logger);

  const results = await repo.bulkUpsert(
    body.updates.map((item: { topicId: string; enabled: boolean }) => ({
      organizationId: orgId,
      personId: user.id,
      topicId: item.topicId,
      enabled: item.enabled,
      createdBy: user.id,
    }))
  );

  ctx.set('auditResourceId', user.id);
  ctx.set('auditDescription', `Bulk updated ${body.updates.length} person subscriptions`);

  return ctx.json(results, 200);
}
