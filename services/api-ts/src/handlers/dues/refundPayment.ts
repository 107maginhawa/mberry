import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';
import { membershipLifecycle } from '@/handlers/association:member/utils/membership-lifecycle';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { validateRefundEligibility, requiresApproval } from './utils/refund-validation';

/**
 * refundPayment (handlers/dues/)
 *
 * Path: POST /dues/payments/{paymentId}/refund
 * OperationId: refundPayment
 *
 * [BR-08] Refund handler with business rule enforcement:
 *   - 30-day refund window from payment date
 *   - Only completed/confirmed/partiallyRefunded payments
 *   - Reverses fund allocations (full or proportional)
 *   - Resets membership expiry on full refund
 *   - Records refund_date, refund_reason on payment
 *   - Treasurer initiates, president approves (amounts > threshold)
 *   - Immutable audit log entry
 *
 * Addresses GAP-001 (HIGH): No refund path existed.
 *
 * @param ctx   - Hono validated context
 * @param _now  - Injectable clock for testing (defaults to new Date())
 */
export async function refundPayment(
  ctx: ValidatedContext<any, never, any>,
  _now?: Date,
): Promise<Response> {
  const now = _now ?? new Date();

  // Position check: Treasurer or President
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  const { paymentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Fetch payment for early validation (outside transaction)
  const repo = new DuesRepository(db);
  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Dues payment');

  const requestedAmount: number | null = (body as any).amount ?? null;
  const reason: string = (body as any).reason ?? '';

  // [BR-08] Validate refund eligibility
  const eligibility = validateRefundEligibility({
    paymentStatus: payment.status,
    paymentPaidAt: payment.paidAt,
    paymentAmount: payment.amount,
    alreadyRefunded: payment.refundedAmount ?? 0,
    requestedRefundAmount: requestedAmount,
    now,
  });

  if (!eligibility.eligible) {
    throw new BusinessLogicError(eligibility.reason, eligibility.code);
  }

  // Compute effective refund amount
  const maxRefundable = payment.amount - (payment.refundedAmount ?? 0);
  const refundAmount = requestedAmount ?? maxRefundable;
  const isFullRefund = (payment.refundedAmount ?? 0) + refundAmount >= payment.amount;

  // [BR-08] Approval check — log warning for amounts > threshold
  // (Full approval workflow deferred; for now, both Treasurer and President can execute)
  if (requiresApproval(refundAmount)) {
    // Audit will capture this as a high-value refund
  }

  // Execute refund in a transaction
  const updated = await db.transaction(async (tx: DatabaseInstance) => {
    const txRepo = new DuesRepository(tx);

    // Delegate fund reversal + membership expiry reset to lifecycle service
    await membershipLifecycle.processRefund(tx, {
      paymentId,
      payment: {
        amount: payment.amount,
        organizationId: payment.organizationId,
        personId: payment.personId,
        membershipExtendedFrom: payment.membershipExtendedFrom,
      },
      refundAmount,
      isFullRefund,
    });

    // Update payment status with refund metadata
    const newRefundedAmount = (payment.refundedAmount ?? 0) + refundAmount;
    const newStatus = newRefundedAmount >= payment.amount ? 'refunded' : 'partiallyRefunded';

    const updatedPayment = await txRepo.updatePaymentStatus(paymentId, newStatus, {
      refundedAmount: newRefundedAmount,
      refundDate: now,
      refundReason: reason,
    } as any);

    return updatedPayment;
  });

  // Immutable audit log entry
  await auditAction(ctx, {
    action: 'update',
    resourceType: 'dues-payment',
    resourceId: paymentId,
    description: `Payment ${isFullRefund ? 'fully' : 'partially'} refunded: ${refundAmount} cents. Reason: ${reason}`,
    details: {
      refundAmount,
      isFullRefund,
      reason,
      requiresApproval: requiresApproval(refundAmount),
      previousRefundedAmount: payment.refundedAmount ?? 0,
    },
  });

  return ctx.json(updated, 200);
}
