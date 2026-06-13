import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { resolveCycle } from '@/handlers/member/credits/utils/credit-cycle';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { eq } from 'drizzle-orm';

/**
 * getMyCreditSummary
 *
 * Path: GET /credit-summary
 * OperationId: getMyCreditSummary
 *
 * Returns aggregated credit totals for the current user across all orgs,
 * backing the member-facing /my/credits and /dashboard views.
 *
 * FIX-006 (G4): required credits AND the cycle window are resolved
 * SERVER-SIDE from the member's org `org_cpd_config` — the SAME single source
 * of truth used by getCreditCompliance / getCreditTranscript. This handler no
 * longer reads `associations.requiredCreditsPerCycle` (a second, divergent
 * source) and no longer honors client-supplied `requiredCredits`,
 * `registrationDate`, `cyclePeriodYears`, or `targetDate` query params, so a
 * member cannot pick a favorable cycle window or lower the requirement to
 * self-certify compliance on their own summary. Falls back to the platform
 * config defaults (60 credits / 3-year cycle) when no config row exists.
 */
export async function getMyCreditSummary(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  // Resolve the member's org from their membership, then the cycle config from
  // that org's org_cpd_config. Defaults (60/3) match org_cpd_config column
  // defaults — no new default literal is introduced here.
  const [membership] = await db.select({
    organizationId: memberships.organizationId,
  }).from(memberships).where(eq(memberships.personId, personId)).limit(1);

  let requiredCredits = 60;
  let cycleStartMonth: number | null = null;
  let cycleLengthYears: number | null = null;
  if (membership?.organizationId) {
    const [config] = await db
      .select()
      .from(orgCpdConfig)
      .where(eq(orgCpdConfig.organizationId, membership.organizationId))
      .limit(1);
    if (config) {
      requiredCredits = config.requiredCredits;
      cycleStartMonth = config.cycleStartMonth;
      cycleLengthYears = config.cycleLengthYears;
    }
  }

  // FIX-006: cycle window is the org-configured, server-resolved window for the
  // current date — client cycle params are ignored entirely.
  const cycle = resolveCycle({ cycleStartMonth, cycleLengthYears }, new Date());

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
