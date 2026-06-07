import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function getCpdConfig(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY, POSITION_TITLES.TREASURER]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const organizationId = ctx.req.param('organizationId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const existing = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, organizationId)).limit(1);
  if (existing.length > 0) return ctx.json({ data: existing[0] });
  const [created] = await db.insert(orgCpdConfig).values({ organizationId, requiredCredits: 60, cycleLengthYears: 3, sdlCapPercent: 40, cycleStartMonth: 1, createdBy: session.user.id, updatedBy: session.user.id }).returning();
  return ctx.json({ data: created }, 201);
}
