import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CreditEntryRepository } from './repos/credits.repo';
import {
  getCycleForDate,
  calculateCarryover,
  summarizeCycle,
  type CreditCycleConfig,
} from './utils/credit-cycle';

/**
 * getCreditTranscript
 *
 * Cross-org aggregated credit summary for the authenticated user.
 * Returns per-org breakdowns and a combined cycle summary with carryover.
 */

interface GetCreditTranscriptQuery {
  registrationDate: string;
  cyclePeriodYears?: string;
  requiredCredits?: string;
  carryoverEnabled?: string;
  /** Earned credits in the previous cycle (for carryover calculation) */
  previousCycleEarned?: string;
  targetDate?: string;
}

export async function getCreditTranscript(
  ctx: ValidatedContext<never, GetCreditTranscriptQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const registrationDate = new Date(query.registrationDate);
  const cyclePeriodYears = Number(query.cyclePeriodYears) || 2;
  const requiredCredits = Number(query.requiredCredits) || 40;
  const carryoverEnabled = query.carryoverEnabled !== 'false';
  const previousCycleEarned = Number(query.previousCycleEarned) || 0;
  const targetDate = query.targetDate ? new Date(query.targetDate) : new Date();

  const cycle = getCycleForDate(registrationDate, targetDate, cyclePeriodYears);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CreditEntryRepository(db, logger);

  // Cross-org aggregation: credits grouped by organization
  const byOrg = await repo.sumCreditsByOrg(user.id, cycle.cycleStart, cycle.cycleEnd);

  const totalEarned = byOrg.reduce((sum, entry) => sum + entry.total, 0);

  // BR-12: Carryover capped at 50% of required credits
  const carryover = calculateCarryover(previousCycleEarned, requiredCredits, carryoverEnabled);

  const summary = summarizeCycle(cycle, totalEarned, requiredCredits, carryover);

  return ctx.json({
    personId: user.id,
    cycle: {
      cycleStart: cycle.cycleStart.toISOString(),
      cycleEnd: cycle.cycleEnd.toISOString(),
      cycleNumber: cycle.cycleNumber,
    },
    organizations: byOrg.map(o => ({
      organizationId: o.organizationId,
      credits: o.total,
    })),
    earned: summary.earned,
    carryoverFromPrevious: summary.carryoverFromPrevious,
    total: summary.total,
    required: summary.required,
    remaining: summary.remaining,
    compliant: summary.compliant,
  }, 200);
}
