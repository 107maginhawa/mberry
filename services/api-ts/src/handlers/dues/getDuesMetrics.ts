import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { GetDuesMetricsParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues-payments.repo';

/**
 * getDuesMetrics
 *
 * Path: GET /association/member/dues-metrics/{organizationId}
 *
 * Returns treasurer-level financial metrics:
 * - Trailing collection rates (30/90/365d windows)
 * - Monthly breakdown (12 months)
 * - Member status distribution (Active/DueSoon/Overdue/Lapsed)
 * - Top unpaid members (up to 10)
 *
 * Position-restricted: TREASURER, PRESIDENT only.
 * collectionRate returned as 0-100 integer (percentage).
 */
export async function getDuesMetrics(
  ctx: ValidatedContext<never, never, GetDuesMetricsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const organizationId = ctx.req.valid('param').organizationId;
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

  const metrics = await repo.getMetricsWithTrends(organizationId);

  return ctx.json({ data: metrics }, 200);
}
