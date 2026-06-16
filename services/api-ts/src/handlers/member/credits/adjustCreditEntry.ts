import type { Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { UnauthorizedError, ValidationError, ConflictError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { creditEntries, orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { resolveCycle } from './utils/credit-cycle';

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

  // FIX-004 (G2): single cycle authority. An officer adjustment is anchored at
  // the time it is made (now); the window comes from org_cpd_config via the one
  // shared resolveCycle() used by every credit-write path.
  const config = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, orgId)).limit(1);
  const now = new Date();
  const { cycleStart, cycleEnd } = resolveCycle(
    { cycleStartMonth: config[0]?.cycleStartMonth, cycleLengthYears: config[0]?.cycleLengthYears },
    now,
  );

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

    // Defer the compliance_standings matview refresh off the request path.
    // We return the written entry directly (no read-back of the view), so
    // eventual consistency is fine. Fire-and-forget — never blocks the response.
    domainEvents.emit('compliance.recompute', {
      organizationId: orgId,
      reason: 'adjustment',
    }).catch(() => {});

    return ctx.json({ data: entry }, 201);
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('uq_credit_source_person')) {
      throw new ConflictError('Credit adjustment already recorded for this idempotency key');
    }
    throw err;
  }
}
