import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchEventsQuery } from '@/generated/openapi/validators';
import { EventRepository } from './repos/events.repo';

/**
 * searchEvents
 *
 * Path: GET /association/events
 * OperationId: searchEvents
 */
export async function searchEvents(
  ctx: ValidatedContext<never, SearchEventsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const limit = Number((query as any)?.limit) || 20;
  const offset = Number((query as any)?.offset) || 0;

  const filters: any = { organizationId: orgId };
  if ((query as any)?.status) filters.status = (query as any).status;

  const results = await repo.findMany(filters, {
    pagination: { limit, offset },
  });

  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
