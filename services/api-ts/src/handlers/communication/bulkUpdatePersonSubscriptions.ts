import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { BulkUpdatePersonSubscriptionsBody } from '@/generated/openapi/validators';
import { PersonSubscriptionRepository, SubscriptionTopicRepository } from './repos/communication.repo';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reduce a notification-preferences UI key to its topic name.
 * The UI sends synthetic "category-channel" keys (e.g. "dues-email",
 * "events-push"). The person_subscription schema has no channel dimension —
 * preferences persist per (person, topic). So we collapse the channel suffix
 * and resolve the leading category to a real seeded topic UUID.
 */
function topicNameFromKey(key: string): string {
  const lastDash = key.lastIndexOf('-');
  if (lastDash <= 0) return key;
  const suffix = key.slice(lastDash + 1);
  // Only strip a recognised channel suffix; otherwise treat the whole key as the name.
  return suffix === 'email' || suffix === 'push' || suffix === 'inapp'
    ? key.slice(0, lastDash)
    : key;
}

/**
 * bulkUpdatePersonSubscriptions
 *
 * Path: POST /association/person-subscriptions/bulk-update
 * OperationId: bulkUpdatePersonSubscriptions
 *
 * Accepts an array of {topicId, enabled} and upserts each. The UI may send
 * either a real topic UUID or a synthetic "category-channel" key; the latter
 * is resolved to a real topic UUID before persistence (FIX-005) so the
 * uuid topic_id column never receives a non-uuid string.
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
  const topicRepo = new SubscriptionTopicRepository(db, logger);

  // Resolve each incoming topicId to a real topic UUID. UUIDs pass through
  // unchanged; synthetic UI keys resolve (find-or-create) by category name.
  const resolved = await Promise.all(
    body.updates.map(async (item: { topicId: string; enabled: boolean }) => {
      let topicId = item.topicId;
      if (!UUID_RE.test(topicId)) {
        const topic = await topicRepo.findOrCreateByName(orgId, topicNameFromKey(topicId));
        topicId = topic.id;
      }
      return {
        organizationId: orgId,
        personId: user.id,
        topicId,
        enabled: item.enabled,
        createdBy: user.id,
      };
    })
  );

  const results = await repo.bulkUpsert(resolved);

  ctx.set('auditResourceId', user.id);
  ctx.set('auditDescription', `Bulk updated ${body.updates.length} person subscriptions`);

  return ctx.json(results, 200);
}
