import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import {
  resolveCycle,
  calculateCarryover,
  summarizeCycle,
} from './utils/credit-cycle';

/**
 * getCreditTranscript
 *
 * Cross-org aggregated credit summary for the authenticated user.
 * Returns per-org breakdowns and a combined cycle summary with carryover.
 *
 * FIX-006 (G4): required credits, cycle length and the cycle window are
 * resolved SERVER-SIDE from the member's org_cpd_config. Client-supplied
 * requiredCredits / cyclePeriodYears / registrationDate / targetDate query
 * params are IGNORED — a member must not be able to lower the requirement (or
 * flip the compliance verdict) on their own transcript. carryoverEnabled /
 * previousCycleEarned remain client inputs (carryover is an informational
 * line item, not the compliance bar). Falls back to platform defaults (60/3)
 * when no config row exists.
 */

interface GetCreditTranscriptQuery {
  carryoverEnabled?: string;
  /** Earned credits in the previous cycle (for carryover calculation) */
  previousCycleEarned?: string;
}

export async function getCreditTranscript(
  ctx: ValidatedContext<never, GetCreditTranscriptQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const carryoverEnabled = query.carryoverEnabled !== 'false';
  const previousCycleEarned = Number(query.previousCycleEarned) || 0;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // FIX-006: resolve required credits + cycle from org_cpd_config, not client.
  const organizationId = ctx.get('organizationId') as string | undefined;
  let requiredCredits = 60;
  let cycleConfig: { cycleStartMonth?: number | null; cycleLengthYears?: number | null } = {};
  if (organizationId) {
    const [config] = await db
      .select()
      .from(orgCpdConfig)
      .where(eq(orgCpdConfig.organizationId, organizationId))
      .limit(1);
    if (config) {
      requiredCredits = config.requiredCredits;
      cycleConfig = { cycleStartMonth: config.cycleStartMonth, cycleLengthYears: config.cycleLengthYears };
    }
  }
  const cycle = resolveCycle(cycleConfig, new Date());

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
