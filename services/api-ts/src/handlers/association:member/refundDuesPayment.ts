import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { RefundDuesPaymentBody, RefundDuesPaymentParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { membershipLifecycle } from './utils/membership-lifecycle';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

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
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Fetch payment outside transaction for early validation
  const repo = new DuesRepository(db);
  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Dues payment');

  if (payment.status === 'refunded') {
    throw new BusinessLogicError('Payment already refunded', 'ALREADY_REFUNDED');
  }

  const refundAmount = (body as any).amount ?? payment.amount;
  const isFullRefund = refundAmount >= payment.amount;

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

    const updatedPayment = await txRepo.updatePaymentStatus(paymentId, newStatus, {
      refundedAmount: newRefundedAmount,
      refundReason: (body as any).reason,
    } as any);

    return updatedPayment;
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'dues-payment',
    resourceId: paymentId,
    description: `Payment ${isFullRefund ? 'fully' : 'partially'} refunded`,
  });

  return ctx.json(updated, 200);
}
