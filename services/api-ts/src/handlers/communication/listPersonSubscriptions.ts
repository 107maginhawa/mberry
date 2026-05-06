import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListPersonSubscriptionsQuery } from '@/generated/openapi/validators';
import { PersonSubscriptionRepository } from './repos/communication.repo';

/**
 * listPersonSubscriptions
 *
 * Path: GET /association/person-subscriptions
 * OperationId: listPersonSubscriptions
 */
export async function listPersonSubscriptions(
  ctx: ValidatedContext<never, ListPersonSubscriptionsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonSubscriptionRepository(db, logger);

  const items = await repo.findByPerson(query.personId, orgId);

  const limit = query.limit ?? query.pageSize ?? 20;
  const offset = query.offset ?? (query.page ? (query.page - 1) * limit : 0);
  const paged = items.slice(offset, offset + limit);

  return ctx.json({ items: paged, total: items.length, offset, limit }, 200);
}
