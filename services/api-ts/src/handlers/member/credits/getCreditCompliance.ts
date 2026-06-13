import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetCreditComplianceParams } from '@/generated/openapi/validators';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { resolveCycle } from './utils/credit-cycle';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

/**
 * getCreditCompliance
 *
 * Path: GET /credit-compliance/{orgId}
 * OperationId: getCreditCompliance
 *
 * Returns org-wide credit compliance report: summary counts + per-member breakdown.
 *
 * FIX-006 (G4): required credits and the cycle window are resolved SERVER-SIDE
 * from the org's org_cpd_config — client-supplied requiredCredits /
 * cyclePeriodYears / registrationDate query params are IGNORED so officers
 * (and members on the transcript) cannot see contradictory verdicts or
 * self-certify compliance. Falls back to the platform config defaults
 * (60 credits / 3-year cycle) when no config row exists.
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
  const { organizationId: orgId } = params as { organizationId: string };

  // Set orgId for requirePosition (route is not under /association/*, no org-context middleware)
  ctx.set('organizationId', orgId);
  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  // FIX-006: single source of truth — resolve required credits + cycle from
  // org_cpd_config. Defaults (60/3) match org_cpd_config column defaults.
  const [config] = await db
    .select()
    .from(orgCpdConfig)
    .where(eq(orgCpdConfig.organizationId, orgId))
    .limit(1);
  const requiredCredits = config?.requiredCredits ?? 60;
  const cycle = resolveCycle(
    { cycleStartMonth: config?.cycleStartMonth, cycleLengthYears: config?.cycleLengthYears },
    new Date(),
  );

  // Get all org members
  const membershipRepo = new MembershipRepository(db);
  const { data: members } = await membershipRepo.listMembers({ organizationId: orgId, limit: 1000 });

  // Calculate credits for each member (skip members without person record)
  const creditRepo = new CreditEntryRepository(db, logger);
  const validMembers = members.filter((m) => m.person !== null);

  // Batch-fetch category breakdown for all members (avoids N+1) (PRC-03)
  const personIds = validMembers.map((m) => m.person!.id);
  const categoryMap = await creditRepo.sumCreditsByCategoryBatch(
    personIds,
    cycle.cycleStart,
    cycle.cycleEnd,
    orgId,
  );

  const memberResults = await Promise.all(
    validMembers.map(async (m) => {
      const earned = await creditRepo.sumCreditsForCycle(
        m.person!.id,
        cycle.cycleStart,
        cycle.cycleEnd,
        orgId,
      );
      const remaining = Math.max(0, requiredCredits - earned);
      let compliance_status: string;
      if (earned >= requiredCredits) {
        compliance_status = 'compliant';
      } else if (earned >= requiredCredits * 0.5) {
        compliance_status = 'at_risk';
      } else {
        compliance_status = 'non_compliant';
      }
      return {
        person_id: m.person!.id,
        first_name: m.person!.firstName,
        last_name: m.person!.lastName,
        member_number: m.membership.memberNumber,
        earned,
        required: requiredCredits,
        remaining,
        compliance_status,
        byCategory: categoryMap.get(m.person!.id) ?? {},
      };
    }),
  );

  const summary = {
    compliant: memberResults.filter((r) => r.compliance_status === 'compliant').length,
    atRisk: memberResults.filter((r) => r.compliance_status === 'at_risk').length,
    nonCompliant: memberResults.filter((r) => r.compliance_status === 'non_compliant').length,
    total: memberResults.length,
    requiredCredits,
  };

  return ctx.json({ summary, data: memberResults }, 200);
}
