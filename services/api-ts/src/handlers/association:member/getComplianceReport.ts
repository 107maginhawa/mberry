import type { Context } from 'hono';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { ComplianceRepository } from './repos/compliance.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function getComplianceReport(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY, POSITION_TITLES.TREASURER]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const organizationId = ctx.req.param('organizationId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ComplianceRepository(db);
  const status = ctx.req.query('status');
  const limit = parseInt(ctx.req.query('limit') ?? '50', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);
  const [summary, standings] = await Promise.all([repo.getOrgSummary(organizationId), repo.getByOrganization(organizationId, { status, limit, offset })]);
  return ctx.json({ data: { summary, standings: standings.data, pagination: { total: standings.total, limit, offset } } });
}
