import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import type { RefundDuesPaymentBody, RefundDuesPaymentParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { membershipLifecycle } from '@/handlers/member/membership/utils/membership-lifecycle';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { validateRefundEligibility } from '@/handlers/association:member/utils/refund-validation';

/**
 * refundDuesPayment
 *
 * Path: POST /association/member/dues-payments/{paymentId}/refund
 * OperationId: refundDuesPayment
 *
 * Reverses fund allocations, resets membership expiry, and recomputes status.
 * Full refund: reverses all allocations at 100%. Partial: proportional reversal.
 */
export async function refundDuesPayment(
  ctx: ValidatedContext<RefundDuesPaymentBody, never, RefundDuesPaymentParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { paymentId } = ctx.req.valid('param');
  const orgId = ctx.get('organizationId') as string;
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Fetch payment outside transaction for early validation
  const repo = new DuesRepository(db);
  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Dues payment');

  // [FIX-002] Tenant-isolation guard: a Treasurer/President of org A must not be
  // able to refund (and reverse membership expiry of) a payment owned by org B.
  // getPayment() is unscoped (by id only), so the org check is enforced here —
  // mirroring confirmPaymentProof / markDuesInvoicePaid sibling mutations.
  if (payment.organizationId !== orgId) {
    throw new ForbiddenError('Payment does not belong to this organization');
  }

  if (payment.status === 'refunded') {
    throw new BusinessLogicError('Payment already refunded', 'ALREADY_REFUNDED');
  }

  const bodyRecord = body as Record<string, unknown>;
  const requestedAmount = (bodyRecord['amount'] as number | undefined) ?? null;

  // [FIX-007][BR-08] Refund eligibility + over-refund cap.
  // validateRefundEligibility enforces: refundable status, 30-day window,
  // and — critically — that the requested amount cannot exceed
  // (paymentAmount - alreadyRefunded). This prevents repeated partial refunds
  // from cumulatively exceeding the original payment (over-refund), which would
  // otherwise let the books show refunds larger than the receipt.
  const alreadyRefunded = payment.refundedAmount ?? 0;
  const eligibility = validateRefundEligibility({
    paymentStatus: payment.status,
    paymentPaidAt: payment.paidAt ?? null,
    paymentAmount: payment.amount,
    alreadyRefunded,
    requestedRefundAmount: requestedAmount,
  });
  if (!eligibility.eligible) {
    throw new BusinessLogicError(eligibility.reason, eligibility.code);
  }

  // Cap to the remaining refundable amount. After eligibility passes,
  // requestedAmount is guaranteed <= remaining, but default (full) refund must
  // also be capped to what is actually left so cumulative never exceeds amount.
  const remaining = payment.amount - alreadyRefunded;
  const refundAmount = requestedAmount ?? remaining;
  const isFullRefund = alreadyRefunded + refundAmount >= payment.amount;

  const updated = await db.transaction(async (tx: DatabaseInstance) => {
    const txRepo = new DuesRepository(tx);

    // Delegate fund reversal + membership expiry reset to lifecycle service
    const refundResult = await membershipLifecycle.processRefund(tx, {
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

    // Update payment status
    const newRefundedAmount = (payment.refundedAmount ?? 0) + refundAmount;
    const newStatus = newRefundedAmount >= payment.amount ? 'refunded' : 'partiallyRefunded';

    const updatedPayment = await txRepo.updatePaymentStatus(paymentId, payment.status, newStatus, {
      refundedAmount: newRefundedAmount,
      refundReason: bodyRecord['reason'] as string,
    } as Record<string, unknown>, session.user.id);

    return updatedPayment;
  });

  ctx.set('auditResourceId', paymentId);
  ctx.set('auditDescription', `Payment ${isFullRefund ? 'fully' : 'partially'} refunded`);

  domainEvents.emit('dues.payment.refunded', {
    paymentId,
    personId: payment.personId,
    organizationId: payment.organizationId,
    refundAmount,
    isFullRefund,
  }).catch(() => {});

  return ctx.json(updated, 200);
}
