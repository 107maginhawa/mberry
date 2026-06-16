import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListWaitlistEntriesQuery, ListWaitlistEntriesParams } from '@/generated/openapi/validators';
import { clampPageSize } from '@/core/pagination';
import { WaitlistEntryRepository } from './repos/events.repo';

/**
 * listWaitlistEntries
 *
 * Path: GET /association/events/{eventId}/waitlist
 * OperationId: listWaitlistEntries
 */
export async function listWaitlistEntries(
  ctx: ValidatedContext<never, ListWaitlistEntriesQuery, ListWaitlistEntriesParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new WaitlistEntryRepository(db, logger);

  const limit = clampPageSize(query.limit === undefined ? 20 : Number(query.limit));
  const offset = Math.max(0, Number(query.offset) || 0);

  const filters: Record<string, unknown> = { eventId: params.eventId };

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
