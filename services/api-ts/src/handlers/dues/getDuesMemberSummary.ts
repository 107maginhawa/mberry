import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { GetDuesMemberSummaryParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues-payments.repo';

/**
 * getDuesMemberSummary
 *
 * Path: GET /association/member/dues-member-summary/{organizationId}/{personId}
 *
 * Returns per-member financial detail:
 * - All invoices with status and dates
 * - All payments with method, status, amount
 * - Computed balance (total unpaid invoice amounts)
 * - Membership status timeline
 *
 * Position-restricted: TREASURER, PRESIDENT only.
 */
export async function getDuesMemberSummary(
  ctx: ValidatedContext<never, never, GetDuesMemberSummaryParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId, personId } = ctx.req.valid('param');
  const ctxOrgId = ctx.get('organizationId');
  if (ctxOrgId) {
    if (organizationId !== ctxOrgId) throw new ForbiddenError();
  } else {
    ctx.set('organizationId', organizationId);
  }

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const summary = await repo.getMemberFinancialSummary(organizationId, personId);

  return ctx.json({ data: summary }, 200);
}
