import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ConflictError } from '@/core/errors';
import type { VerifyCreditEntryParams } from '@/generated/openapi/validators';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * verifyCreditEntry
 *
 * Path: POST /association/member/credits/{creditEntryId}/verify
 * OperationId: verifyCreditEntry
 *
 * Officer approves a member self-logged CPD credit entry sitting at
 * verification_status='pending'. Mirrors confirmPaymentProof: load → org-scope
 * guard → status guard → update → emit → audit → return.
 *
 * Position-restricted: President, Secretary, Treasurer (inline carve-out — org
 * is derived at runtime from the loaded entry, not a static path/body param).
 */
export async function verifyCreditEntry(
  ctx: ValidatedContext<never, never, VerifyCreditEntryParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { creditEntryId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  // Load the entry first — the org used for the officer check comes from the
  // entry itself (the path carries only creditEntryId).
  const [entry] = await db
    .select()
    .from(creditEntries)
    .where(eq(creditEntries.id, creditEntryId))
    .limit(1);

  if (!entry) throw new NotFoundError('CreditEntry');

  // Derive org from the loaded entry, then run the inline officer check. This
  // scopes the operation to the officer's org: requirePosition only passes if
  // the caller holds a matching active term in entry.organizationId, so an
  // officer of another org gets a 403 (the entry is effectively not in scope).
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
      `Cannot verify credit entry with verification status '${entry.verificationStatus}'. Must be 'pending'.`,
    );
  }

  const [updated] = await db
    .update(creditEntries)
    .set({
      verificationStatus: 'verified',
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(creditEntries.id, entry.id))
    .returning();

  // Verifying a pending entry makes it count toward the cycle — refresh the
  // compliance_standings matview off the request path (mirrors awardManualCredit).
  domainEvents.emit('compliance.recompute', {
    organizationId: orgId,
    reason: 'credit_verified',
  }).catch(() => {});

  ctx.set('auditResourceId', entry.id);
  ctx.set('auditDescription', 'Member credit entry verified by officer');

  return ctx.json({ data: updated }, 200);
}
