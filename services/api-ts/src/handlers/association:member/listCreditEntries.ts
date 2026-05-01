import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CreditEntryRepository } from './repos/credits.repo';
import { getCycleForDate } from './utils/credit-cycle';

/**
 * listCreditEntries
 *
 * List credit entries for a person within a cycle.
 * Query params: personId (optional, defaults to self), registrationDate, cyclePeriodYears,
 *               targetDate (optional, defaults to now), offset, limit
 */

interface ListCreditEntriesQuery {
  personId?: string;
  organizationId?: string;
  registrationDate?: string;
  cyclePeriodYears?: string;
  targetDate?: string;
  type?: 'auto' | 'manual';
  offset?: string;
  limit?: string;
}

export async function listCreditEntries(
  ctx: ValidatedContext<never, ListCreditEntriesQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const personId = query.personId || user.id;
  const offset = Number(query.offset) || 0;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CreditEntryRepository(db, logger);

  // If registration date provided, scope to a specific cycle
  let cycleStart: Date | undefined;
  let cycleEnd: Date | undefined;

  if (query.registrationDate) {
    const registrationDate = new Date(query.registrationDate);
    const cyclePeriodYears = Number(query.cyclePeriodYears) || 2;
    const targetDate = query.targetDate ? new Date(query.targetDate) : new Date();
    const cycle = getCycleForDate(registrationDate, targetDate, cyclePeriodYears);
    cycleStart = cycle.cycleStart;
    cycleEnd = cycle.cycleEnd;
  }

  const result = await repo.findManyWithPagination(
    {
      tenantId,
      personId,
      organizationId: query.organizationId,
      type: query.type,
      cycleStart,
      cycleEnd,
    },
    { pagination: { offset, limit } },
  );

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: result.data,
    pagination: {
      offset,
      limit,
      count: result.data.length,
      totalCount: result.totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
