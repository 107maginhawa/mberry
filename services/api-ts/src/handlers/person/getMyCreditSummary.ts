import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { getCycleForDate } from '@/handlers/association:member/utils/credit-cycle';

/**
 * getMyCreditSummary
 *
 * Path: GET /credit-summary
 * OperationId: getMyCreditSummary
 *
 * Returns aggregated credit totals for the current user across all orgs.
 * Query params: registrationDate (required), cyclePeriodYears (default 2), targetDate (default now)
 */
export async function getMyCreditSummary(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const registrationDateStr = ctx.req.query('registrationDate');
  const registrationDate = registrationDateStr ? new Date(registrationDateStr) : new Date();
  const cyclePeriodYears = Number(ctx.req.query('cyclePeriodYears') ?? '2');
  const targetDate = ctx.req.query('targetDate') ? new Date(ctx.req.query('targetDate')!) : new Date();

  const cycle = getCycleForDate(registrationDate, targetDate, cyclePeriodYears);

  const repo = new CreditEntryRepository(db, logger);
  const byOrg = await repo.sumCreditsByOrg(personId, cycle.cycleStart, cycle.cycleEnd);
  const totalEarned = byOrg.reduce((sum, o) => sum + o.total, 0);

  return ctx.json({
    personId,
    cycle: {
      cycleStart: cycle.cycleStart.toISOString(),
      cycleEnd: cycle.cycleEnd.toISOString(),
    },
    totalEarned,
    organizations: byOrg,
  }, 200);
}
