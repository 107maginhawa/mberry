import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchCheckInsQuery } from '@/generated/openapi/validators';
import { CheckInRepository } from './repos/events.repo';

/**
 * searchCheckIns
 *
 * Path: GET /association/events/checkins
 * OperationId: searchCheckIns
 */
export async function searchCheckIns(
  ctx: ValidatedContext<never, SearchCheckInsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CheckInRepository(db, logger);

  const limit = Number((query as any)?.limit) || 20;
  const offset = Number((query as any)?.offset) || 0;

  const filters: any = { tenantId };
  if ((query as any)?.eventId) filters.eventId = (query as any).eventId;
  if ((query as any)?.personId) filters.personId = (query as any).personId;

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
