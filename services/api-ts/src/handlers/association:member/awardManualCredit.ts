import type { Context } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { UnauthorizedError, ValidationError, ConflictError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { creditEntries, orgCpdConfig } from './repos/credits.schema';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function awardManualCredit(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY, POSITION_TITLES.TREASURER]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const body = await ctx.req.json();
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  if (!body.personId || !body.activityName || !body.activityDate || !body.creditAmount || !body.idempotencyKey) throw new ValidationError('personId, activityName, activityDate, creditAmount, idempotencyKey required');
  if (body.creditAmount <= 0) throw new ValidationError('creditAmount must be positive');

  let sdlCapWarning: string | null = null;
  if (body.category === 'Self-Directed') {
    const config = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, orgId)).limit(1);
    const sdlMax = Math.floor(((config[0]?.sdlCapPercent ?? 40) / 100) * (config[0]?.requiredCredits ?? 60));
    const sdlTotal = await db.select({ total: sql<number>`COALESCE(SUM(${creditEntries.creditAmount}), 0)` }).from(creditEntries).where(and(eq(creditEntries.personId, body.personId), eq(creditEntries.organizationId, orgId), eq(creditEntries.status, 'active'), eq(creditEntries.category, 'Self-Directed')));
    if (Number(sdlTotal[0]?.total ?? 0) + body.creditAmount > sdlMax) sdlCapWarning = `SDL cap exceeded (${Number(sdlTotal[0]?.total ?? 0) + body.creditAmount}/${sdlMax}). Officer override.`;
  }

  const config = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, orgId)).limit(1);
  const csm = config[0]?.cycleStartMonth ?? 1; const cly = config[0]?.cycleLengthYears ?? 3;
  const ad = new Date(body.activityDate); const y = ad.getFullYear(); const m = ad.getMonth() + 1;
  const csy = m < csm ? y - 1 : y; const ci = Math.floor((csy - 2020) / cly); const asy = 2020 + ci * cly;
  const cycleStart = new Date(asy, csm - 1, 1); const cycleEnd = new Date(asy + cly, csm - 1, 1);

  try {
    const [entry] = await db.insert(creditEntries).values({ personId: body.personId, organizationId: orgId, type: 'manual', activityName: body.activityName, provider: body.provider ?? null, activityDate: ad, creditAmount: body.creditAmount, cycleStart, cycleEnd, supportingDocumentId: body.supportingDocumentId ?? null, category: body.category ?? null, verificationStatus: 'verified', sourceType: 'manual_award', sourceId: body.idempotencyKey, cpdActivityType: (body.cpdActivityType ?? null) as typeof creditEntries.cpdActivityType.enumValues[number] | null, status: 'active', createdBy: session.user.id, updatedBy: session.user.id }).returning();
    domainEvents.emit('credit.adjusted', {
      creditEntryId: entry!.id,
      personId: body.personId,
      organizationId: orgId,
      adjustedBy: session.user.id,
      creditAmount: body.creditAmount,
      reason: body.activityName,
    }).catch(() => {});
    try { await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`); } catch { /* view may not exist */ }
    return ctx.json({ data: entry, ...(sdlCapWarning && { warning: sdlCapWarning }) }, 201);
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('uq_credit_source_person')) throw new ConflictError('Credit already awarded with this idempotency key');
    throw err;
  }
}
