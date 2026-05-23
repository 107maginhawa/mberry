import type { Context } from 'hono';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { ComplianceRepository } from './repos/compliance.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function refreshCompliance(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const db = ctx.get('database') as DatabaseInstance;
  await new ComplianceRepository(db).refresh();
  return ctx.json({ data: { refreshed: true, at: new Date().toISOString() } });
}
