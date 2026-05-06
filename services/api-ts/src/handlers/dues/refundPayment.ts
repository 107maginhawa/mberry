import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, ValidationError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function refundPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(id);
  if (!payment) throw new NotFoundError('Payment not found');
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.getMember(payment.organizationId, session.user.id);
  if (!membership) throw new ForbiddenError('Access denied to this resource');

  const refundAmount = body.amount ?? payment.amount;
  const maxRefundable = payment.amount - payment.refundedAmount;

  if (refundAmount > maxRefundable) {
    throw new ValidationError(`Refund cannot exceed ${maxRefundable} cents (remaining refundable amount)`);
  }

  const allocations = await repo.getFundAllocations(id);
  const originalAllocations = allocations.filter((a) => !a.isReversal);

  if (originalAllocations.length > 0) {
    const refundRatio = refundAmount / payment.amount;
    const reversals = originalAllocations.map((a) => ({
      paymentId: id,
      fundId: a.fundId,
      amount: -Math.round(a.amount * refundRatio),
      isReversal: true,
    }));
    await repo.createFundAllocations(reversals);
  }

  const newRefundedAmount = payment.refundedAmount + refundAmount;
  const newStatus = newRefundedAmount >= payment.amount ? 'refunded' : 'partiallyRefunded';

  const updated = await repo.updatePaymentStatus(id, newStatus, {
    refundedAmount: newRefundedAmount,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
