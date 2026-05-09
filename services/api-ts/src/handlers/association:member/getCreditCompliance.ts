import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetCreditComplianceParams } from '@/generated/openapi/validators';
import { CreditEntryRepository } from './repos/credits.repo';
import { getCycleForDate, summarizeCycle } from './utils/credit-cycle';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * getCreditCompliance
 *
 * Path: GET /credit-compliance/{orgId}
 * OperationId: getCreditCompliance
 *
 * Returns compliance summary for the current user in a given org.
 * Query params: registrationDate, cyclePeriodYears (default 2), requiredCredits (default 40)
 *
 * Position-restricted: SOCIETY_OFFICER, PRESIDENT only (D-03).
 */
export async function getCreditCompliance(
  ctx: ValidatedContext<never, never, GetCreditComplianceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const params = ctx.req.valid('param');
  const orgId = (params as any).orgId;

  // Set orgId for requirePosition (route is not under /association/*, no org-context middleware)
  ctx.set('orgId', orgId);
  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;
  const personId = session.user.id;

  const registrationDateStr = ctx.req.query('registrationDate');
  const registrationDate = registrationDateStr ? new Date(registrationDateStr) : new Date();
  const cyclePeriodYears = Number(ctx.req.query('cyclePeriodYears') ?? '2');
  const requiredCredits = Number(ctx.req.query('requiredCredits') ?? '40');
  const targetDate = ctx.req.query('targetDate') ? new Date(ctx.req.query('targetDate')!) : new Date();

  const cycle = getCycleForDate(registrationDate, targetDate, cyclePeriodYears);

  const repo = new CreditEntryRepository(db, logger);
  const earned = await repo.sumCreditsForCycle(personId, cycle.cycleStart, cycle.cycleEnd, orgId);

  const summary = summarizeCycle(cycle, earned, requiredCredits, 0);

  return ctx.json({
    personId,
    organizationId: orgId,
    cycle: {
      cycleStart: cycle.cycleStart.toISOString(),
      cycleEnd: cycle.cycleEnd.toISOString(),
    },
    earned: summary.earned,
    required: summary.required,
    remaining: summary.remaining,
    compliant: summary.compliant,
  }, 200);
}
