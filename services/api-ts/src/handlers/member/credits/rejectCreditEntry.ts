import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ConflictError } from '@/core/errors';
import type { RejectCreditEntryBody, RejectCreditEntryParams } from '@/generated/openapi/validators';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * rejectCreditEntry
 *
 * Path: POST /association/member/credits/{creditEntryId}/reject
 * OperationId: rejectCreditEntry
 *
 * Officer rejects a member self-logged CPD credit entry sitting at
 * verification_status='pending', with an optional reason. Mirrors
 * rejectPaymentProof: load → org-scope guard → status guard → update → emit →
 * audit → return. A rejected entry stops counting toward the cycle.
 *
 * Position-restricted: President, Secretary, Treasurer (inline carve-out — org
 * is derived at runtime from the loaded entry, not a static path/body param).
 */
export async function rejectCreditEntry(
  ctx: ValidatedContext<RejectCreditEntryBody, never, RejectCreditEntryParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { creditEntryId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Load the entry first — the org used for the officer check comes from the
  // entry itself (the path carries only creditEntryId).
  const [entry] = await db
    .select()
    .from(creditEntries)
    .where(eq(creditEntries.id, creditEntryId))
    .limit(1);

  if (!entry) throw new NotFoundError('CreditEntry');

  // Derive org from the loaded entry, then run the inline officer check —
  // scopes the operation to the officer's org (cross-org callers get 403).
  const orgId = entry.organizationId;
  ctx.set('organizationId', orgId);
  const denied = await requirePosition(ctx, [
    POSITION_TITLES.PRESIDENT,
    POSITION_TITLES.SECRETARY,
    POSITION_TITLES.TREASURER,
  ]);
  if (denied) return denied;

  // Must currently be pending (idempotency / state-machine guard).
  if (entry.verificationStatus !== 'pending') {
    throw new ConflictError(
      `Cannot reject credit entry with verification status '${entry.verificationStatus}'. Must be 'pending'.`,
    );
  }

  // body.reason is optional (RejectCreditEntryRequest). There is no dedicated
  // rejection-reason column on credit_entry (voidedReason is for status='voided'),
  // so the reason is preserved in the attestation jsonb when supplied and simply
  // ignored when absent — never blocks the rejection.
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const attestation = reason
    ? {
        ...(typeof entry.attestation === 'object' && entry.attestation !== null
          ? (entry.attestation as Record<string, unknown>)
          : {}),
        rejectionReason: reason,
        rejectedBy: session.user.id,
        rejectedAt: new Date().toISOString(),
      }
    : entry.attestation;

  const [updated] = await db
    .update(creditEntries)
    .set({
      verificationStatus: 'rejected',
      updatedBy: session.user.id,
      updatedAt: new Date(),
      attestation,
    })
    .where(eq(creditEntries.id, entry.id))
    .returning();

  // A rejected entry no longer counts toward the cycle — refresh the
  // compliance_standings matview off the request path (mirrors awardManualCredit).
  domainEvents.emit('compliance.recompute', {
    organizationId: orgId,
    reason: 'credit_rejected',
  }).catch(() => {});

  ctx.set('auditResourceId', entry.id);
  ctx.set('auditDescription', reason
    ? `Member credit entry rejected by officer: ${reason}`
    : 'Member credit entry rejected by officer');

  return ctx.json({ data: updated }, 200);
}
