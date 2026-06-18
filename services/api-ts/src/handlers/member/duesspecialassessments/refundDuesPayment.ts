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

  // [FIX-007][BR-08] Pre-transaction eligibility check — fast-fail on the cheap,
  // non-racy predicates (refundable status, 30-day window, obvious cap) using
  // the unlocked snapshot. This gives an early 422 without opening a tx, but it
  // is NOT the authoritative over-refund guard — see the FIX-008 re-check below.
  const alreadyRefundedSnapshot = payment.refundedAmount ?? 0;
  const eligibility = validateRefundEligibility({
    paymentStatus: payment.status,
    paymentPaidAt: payment.paidAt ?? null,
    paymentAmount: payment.amount,
    alreadyRefunded: alreadyRefundedSnapshot,
    requestedRefundAmount: requestedAmount,
  });
  if (!eligibility.eligible) {
    throw new BusinessLogicError(eligibility.reason, eligibility.code);
  }

  let isFullRefund = false;
  let refundAmount = 0;

  const updated = await db.transaction(async (tx: DatabaseInstance) => {
    const txRepo = new DuesRepository(tx);

    // [FIX-008] Over-refund race fix. Re-read the payment row under a
    // SELECT … FOR UPDATE lock so the cap check + refundedAmount increment are
    // atomic. Two concurrent partial refunds that each read alreadyRefunded=0
    // OUTSIDE the tx would both pass the snapshot eligibility check above and
    // both apply, cumulatively exceeding the original payment. With the lock the
    // second refund blocks until the first commits, then re-validates against
    // the FRESH refundedAmount and is rejected. Integer-cents throughout.
    const locked = await txRepo.getPaymentForUpdate(paymentId);
    if (!locked) throw new NotFoundError('Dues payment');

    const alreadyRefunded = locked.refundedAmount ?? 0;

    // Authoritative cap re-check against the locked row. Preserves the same
    // error code/message contract as the pre-tx check (EXCEEDS_REFUNDABLE etc.).
    const recheck = validateRefundEligibility({
      paymentStatus: locked.status,
      paymentPaidAt: locked.paidAt ?? null,
      paymentAmount: locked.amount,
      alreadyRefunded,
      requestedRefundAmount: requestedAmount,
    });
    if (!recheck.eligible) {
      throw new BusinessLogicError(recheck.reason, recheck.code);
    }

    // Cap default (full) refund to what is actually left under the lock so the
    // cumulative refundedAmount can never exceed the original amount.
    const remaining = locked.amount - alreadyRefunded;
    refundAmount = requestedAmount ?? remaining;
    isFullRefund = alreadyRefunded + refundAmount >= locked.amount;

    // Delegate fund reversal + membership expiry reset to lifecycle service
    await membershipLifecycle.processRefund(tx, {
      paymentId,
      payment: {
        amount: locked.amount,
        organizationId: locked.organizationId,
        personId: locked.personId,
        membershipExtendedFrom: locked.membershipExtendedFrom,
      },
      refundAmount,
      isFullRefund,
    });

    // Update payment status — increment computed from the LOCKED row, not the
    // pre-tx snapshot.
    const newRefundedAmount = alreadyRefunded + refundAmount;
    const newStatus = newRefundedAmount >= locked.amount ? 'refunded' : 'partiallyRefunded';

    const updatedPayment = await txRepo.updatePaymentStatus(paymentId, locked.status, newStatus, {
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
