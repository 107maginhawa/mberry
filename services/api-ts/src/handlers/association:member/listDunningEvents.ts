import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListDunningEventsQuery } from '@/generated/openapi/validators';
import { DunningEventRepository } from './repos/dunning.repo';

/**
 * listDunningEvents
 *
 * Path: GET /association/member/dunning/events
 * OperationId: listDunningEvents
 */
export async function listDunningEvents(
  ctx: ValidatedContext<never, ListDunningEventsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DunningEventRepository(db, logger);

  const offset = Number(query.offset) || 0;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const filters: any = {};
  if (query.membershipId) {
    filters.membershipId = query.membershipId;
  }
  if (query.stage !== undefined) {
    filters.stage = Number(query.stage);
  }

  const [data, totalCount] = await Promise.all([
    repo.findMany(filters, { pagination: { offset, limit } }),
    repo.count(filters),
  ]);

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data,
    pagination: {
      offset,
      limit,
      count: data.length,
      totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
