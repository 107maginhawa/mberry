import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { DuesRepository } from './repos/dues.repo';
import { formatReceiptNumber } from './utils/receipt-number';
import { settlePayment } from './utils/settle-payment';
import { auditAction } from '@/utils/audit';

/**
 * recordManualPayment (handlers/dues/)
 *
 * Treasurer records an offline/manual payment (cash, check, bank deposit, gcash).
 * Orchestrates:
 *   1. Concurrent payment warning (M6-R4) — 5-min duplicate detection window
 *   2. Receipt number generation (M6-R6)
 *   3. Payment creation + fund allocation + expiry extension (BR-07) in a single transaction
 *
 * Position-restricted: caller must have TREASURER or PRESIDENT position.
 */
export async function recordManualPayment(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const session = ctx.get('session');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  // [M6-R4] Concurrent payment guard — check for recent payment within 5-min window
  const recentPayment = await repo.findRecentPaymentForPerson(orgId, body.personId);
  const hasConcurrentWarning = !!recentPayment;

  // [M6-R6] Generate receipt number in org sequence
  const year = new Date().getFullYear();
  const sequence = await repo.getNextReceiptSequence(orgId, year);
  const receiptNumber = formatReceiptNumber('ORG', year, sequence);

  // Wrap payment creation + settlement in a single transaction
  const { payment, settlement } = await db.transaction(async (txDb: DatabaseInstance) => {
    const txRepo = new DuesRepository(txDb);

    const pay = await txRepo.createPayment({
      organizationId: orgId,
      personId: body.personId,
      receiptNumber,
      amount: body.amount,
      currency: body.currency ?? 'PHP',
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber ?? null,
      status: 'completed',
      recordedBy: session?.user?.id ?? user.id,
      paidAt: new Date(),
      createdBy: session?.user?.id ?? user.id,
      updatedBy: session?.user?.id ?? user.id,
    });

    // [BR-07] Fund allocation + membership expiry extension
    // settlePayment delegates to membershipLifecycle.settlePayment inside the tx
    const settle = await settlePayment({
      db,
      orgId,
      personId: body.personId,
      paymentId: pay.id,
      amount: body.amount,
      tx: txDb,
    });

    // Update payment with extension dates
    if (settle.membershipExtendedTo) {
      await txRepo.updatePaymentStatus(pay.id, 'completed', {
        membershipExtendedFrom: settle.membershipExtendedFrom,
        membershipExtendedTo: settle.membershipExtendedTo,
      });
    }

    return { payment: pay, settlement: settle };
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-payment',
    resourceId: payment.id,
    description: `Manual payment recorded: ${body.paymentMethod}, ref: ${body.referenceNumber ?? 'none'}`,
    details: { method: body.paymentMethod, reference: body.referenceNumber },
    eventSubType: 'financial.payment-recorded',
  });

  return ctx.json({
    ...payment,
    receiptNumber,
    fundAllocations: settlement.fundAllocations,
    membershipExtendedFrom: settlement.membershipExtendedFrom,
    membershipExtendedTo: settlement.membershipExtendedTo,
    meta: { concurrentWarning: hasConcurrentWarning, recentPayment: recentPayment ?? null },
  }, 201);
}
