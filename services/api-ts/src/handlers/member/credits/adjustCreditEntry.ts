import type { Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { UnauthorizedError, ValidationError, ConflictError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { creditEntries, orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

// Acceptance Criteria: [AC-M10-005] mandatory adjustment reason — M10-R4
export async function adjustCreditEntry(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [
    POSITION_TITLES.PRESIDENT,
    POSITION_TITLES.SECRETARY,
    POSITION_TITLES.TREASURER,
  ]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = await ctx.req.json();
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;

  if (!body.personId) throw new ValidationError('personId required');
  if (typeof body.creditAmount !== 'number' || !Number.isFinite(body.creditAmount) || body.creditAmount === 0) {
    throw new ValidationError('creditAmount required (non-zero number, negative for deduction)');
  }
  const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reasonRaw) throw new ValidationError('reason required');
  if (reasonRaw.length < 10) throw new ValidationError('reason required (min 10 characters)');

  const config = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, orgId)).limit(1);
  const csm = (config[0] as any)?.cycleStartMonth ?? 1;
  const cly = (config[0] as any)?.cycleLengthYears ?? 3;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const csy = m < csm ? y - 1 : y;
  const ci = Math.floor((csy - 2020) / cly);
  const asy = 2020 + ci * cly;
  const cycleStart = new Date(asy, csm - 1, 1);
  const cycleEnd = new Date(asy + cly, csm - 1, 1);

  const sourceId = body.idempotencyKey ?? randomUUID();

  try {
    const [entry] = await db
      .insert(creditEntries)
      .values({
        personId: body.personId,
        organizationId: orgId,
        type: 'manual',
        activityName: 'Officer Adjustment',
        provider: null,
        activityDate: now,
        creditAmount: body.creditAmount,
        cycleStart,
        cycleEnd,
        supportingDocumentId: null,
        category: null,
        verificationStatus: 'verified',
        sourceType: 'manual_award',
        sourceId,
        cpdActivityType: null,
        attestation: {
          adjustmentReason: reasonRaw,
          adjustedBy: session.user.id,
          adjustedAt: now.toISOString(),
        },
        status: 'active',
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    domainEvents.emit('credit.adjusted', {
      creditEntryId: entry!.id,
      personId: body.personId,
      organizationId: orgId,
      adjustedBy: session.user.id,
      creditAmount: body.creditAmount,
      reason: reasonRaw,
    }).catch(() => {});

    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`);
    } catch {
      /* view may not exist */
    }

    return ctx.json({ data: entry }, 201);
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('uq_credit_source_person')) {
      throw new ConflictError('Credit adjustment already recorded for this idempotency key');
    }
    throw err;
  }
}
