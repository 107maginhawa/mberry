import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListWaitlistEntriesQuery, ListWaitlistEntriesParams } from '@/generated/openapi/validators';
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

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new WaitlistEntryRepository(db, logger);

  const limit = Number((query as any)?.limit) || 20;
  const offset = Number((query as any)?.offset) || 0;

  const filters: any = { eventId: (params as any).eventId };

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
