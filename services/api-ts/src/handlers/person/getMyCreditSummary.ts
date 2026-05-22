import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { getCycleForDate } from '@/handlers/association:member/utils/credit-cycle';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { associations, organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { eq } from 'drizzle-orm';

/**
 * getMyCreditSummary
 *
 * Path: GET /credit-summary
 * OperationId: getMyCreditSummary
 *
 * Returns aggregated credit totals for the current user across all orgs.
 * Query params: registrationDate (optional — auto-looked up from membership if missing),
 *               cyclePeriodYears (default 3), targetDate (default now)
 */
export async function getMyCreditSummary(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  // Auto-lookup registrationDate + requiredCredits from membership → org → association
  let registrationDateStr = ctx.req.query('registrationDate');
  let requiredCredits = 60; // default
  const [membership] = await db.select({
    startDate: memberships.startDate,
    organizationId: memberships.organizationId,
  }).from(memberships).where(eq(memberships.personId, personId)).limit(1);
  if (!registrationDateStr) {
    registrationDateStr = membership?.startDate || '2025-01-01';
  }
  if (membership?.organizationId) {
    const [org] = await db.select({ associationId: organizations.associationId })
      .from(organizations).where(eq(organizations.id, membership.organizationId)).limit(1);
    if (org?.associationId) {
      const [assoc] = await db.select({ requiredCreditsPerCycle: associations.requiredCreditsPerCycle })
        .from(associations).where(eq(associations.id, org.associationId)).limit(1);
      if (assoc?.requiredCreditsPerCycle) requiredCredits = assoc.requiredCreditsPerCycle;
    }
  }
  const registrationDate = new Date(registrationDateStr);
  const cyclePeriodYears = Number(ctx.req.query('cyclePeriodYears') ?? '3');
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
    totalCredits: totalEarned,
    requiredCredits,
    remaining: Math.max(0, requiredCredits - totalEarned),
    organizations: byOrg,
  }, 200);
}
