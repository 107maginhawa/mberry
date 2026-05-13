import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetCreditComplianceParams } from '@/generated/openapi/validators';
import { CreditEntryRepository } from './repos/credits.repo';
import { getCycleForDate } from './utils/credit-cycle';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { MembershipRepository } from '../membership/repos/membership.repo';

/**
 * getCreditCompliance
 *
 * Path: GET /credit-compliance/{orgId}
 * OperationId: getCreditCompliance
 *
 * Returns org-wide credit compliance report: summary counts + per-member breakdown.
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
  ctx.set('organizationId', orgId);
  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const registrationDateStr = ctx.req.query('registrationDate');
  const registrationDate = registrationDateStr ? new Date(registrationDateStr) : new Date();
  const cyclePeriodYears = Number(ctx.req.query('cyclePeriodYears') ?? '2');
  const requiredCredits = Number(ctx.req.query('requiredCredits') ?? '40');
  const targetDate = ctx.req.query('targetDate') ? new Date(ctx.req.query('targetDate')!) : new Date();

  const cycle = getCycleForDate(registrationDate, targetDate, cyclePeriodYears);

  // Get all org members
  const membershipRepo = new MembershipRepository(db);
  const { data: members } = await membershipRepo.listMembers({ organizationId: orgId, limit: 1000 });

  // Calculate credits for each member (skip members without person record)
  const creditRepo = new CreditEntryRepository(db, logger);
  const validMembers = members.filter((m) => m.person !== null);
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
