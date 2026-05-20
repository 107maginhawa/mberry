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

  const query = ctx.req.valid('query');
  const orgId = query.organizationId;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const limit = Number(query.limit) || 20;
  const offset = Number(query.offset) || 0;

  const filters: Record<string, unknown> = {};
  if (orgId) filters['organizationId'] = orgId;
  const q = query as Record<string, unknown>;
  if (q['status']) filters['status'] = q['status'];

  const results = await repo.findMany(filters, {
    pagination: { limit, offset },
  });

  const totalCount = await repo.count(filters);

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: results,
    pagination: {
      offset,
      limit,
      count: results.length,
      totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
