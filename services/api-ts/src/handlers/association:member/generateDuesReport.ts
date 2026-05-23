import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { GenerateDuesReportQuery, GenerateDuesReportParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues-payments.repo';

/**
 * generateDuesReport
 *
 * Path: GET /association/member/dues-reporting/{organizationId}/report
 * OperationId: generateDuesReport
 */
export async function generateDuesReport(
  ctx: ValidatedContext<never, GenerateDuesReportQuery, GenerateDuesReportParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const ctxOrgId = ctx.get('organizationId');
  // [CR-04] If middleware has already set an org context, the route param MUST
  // match it — an attacker must not be able to override the verified org by
  // supplying a different organizationId in the URL.
  if (ctxOrgId) {
    if (organizationId !== ctxOrgId) throw new ForbiddenError();
  } else {
    // No middleware-set orgId (e.g. this route is outside /association/*).
    // Fall back to trusting the route param, which requirePosition will
    // scope-check against the caller's officer record.
    ctx.set('organizationId', organizationId);
  }
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const fromDate = query.from ?? new Date(new Date().getFullYear(), 0, 1);
  const toDate = query.to ?? new Date();
  const type = query.type;

  let data: any;
  let summary: any = {};

  switch (type) {
    case 'collection': {
      data = await repo.reportCollectionSummary(organizationId, fromDate, toDate);
      const totalCollected = data.reduce((sum: number, row: any) => sum + row.total, 0);
      summary = { totalCollected, rowCount: data.length };
      break;
    }
    case 'fund_breakdown': {
      data = await repo.reportFundBreakdown(organizationId, fromDate, toDate);
      summary = { fundCount: data.length };
      break;
    }
    case 'dues_status': {
      data = await repo.reportDuesStatus(organizationId, fromDate, toDate);
      summary = { memberCount: data.length };
      break;
    }
    case 'aging': {
      data = await repo.reportAging(organizationId, fromDate, toDate);
      summary = { totalOverdue: data.length };
      break;
    }
  }

  return ctx.json({
    data,
    summary,
    meta: { type, from: fromDate.toISOString(), to: toDate.toISOString() },
  }, 200);
}
