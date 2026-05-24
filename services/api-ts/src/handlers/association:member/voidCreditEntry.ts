import type { Context } from 'hono';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { UnauthorizedError, ValidationError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { creditEntries } from './repos/credits.schema';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function voidCreditEntry(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY, POSITION_TITLES.TREASURER]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const body = await ctx.req.json();
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;

  if (!body.activityName || !body.personIds || !Array.isArray(body.personIds) || body.personIds.length === 0) {
    throw new ValidationError('activityName and personIds[] required');
  }
  if (!body.reason || body.reason.trim().length < 10) {
    throw new ValidationError('reason required (min 10 characters)');
  }

  const result = await db
    .update(creditEntries)
    .set({
      status: 'voided',
      voidedReason: body.reason.trim(),
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(creditEntries.personId, body.personIds),
        eq(creditEntries.activityName, body.activityName),
        eq(creditEntries.sourceType, 'manual_award'),
        eq(creditEntries.organizationId, orgId),
        eq(creditEntries.status, 'active'),
      ),
    )
    .returning({ id: creditEntries.id });

  if (result.length === 0) {
    throw new NotFoundError('No active credits found to revoke');
  }

  try {
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`);
  } catch { /* view may not exist */ }

  return ctx.json({ data: { voidedCount: result.length } }, 200);
}
