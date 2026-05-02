import type { Context } from 'hono';
import { NotFoundError, ValidationError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';
import type { Session } from '@/types/auth';

export async function refundPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(id);
  if (!payment) throw new NotFoundError('Payment not found');

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
  const newStatus = newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';

  const updated = await repo.updatePaymentStatus(id, newStatus, {
    refundedAmount: newRefundedAmount,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
