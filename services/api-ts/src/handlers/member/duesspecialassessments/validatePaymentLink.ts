import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { verifyPaymentToken } from '@/handlers/association:member/utils/payment-token';

/**
 * validatePaymentLink
 *
 * Public endpoint — validates a payment link token without auth.
 * Returns invoice details for the public payment page.
 */
export async function validatePaymentLink(
  ctx: ValidatedContext<never, never, { token: string }>
): Promise<Response> {
  const token = ctx.req.valid('param').token;
  if (!token) {
    return ctx.json({ error: 'Token is required' }, 400);
  }

  const secret = process.env['PAYMENT_LINK_SECRET'] || 'dev-payment-link-secret';
  const payload = verifyPaymentToken(token, secret);

  if (!payload) {
    return ctx.json({ error: 'Invalid or expired payment link' }, 404);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoice = await invoiceRepo.findOneById(payload.invoiceId);
  if (!invoice) {
    return ctx.json({ error: 'Invoice not found' }, 404);
  }

  if (invoice.status === 'paid') {
    return ctx.json({
      status: 'already_paid',
      invoiceId: invoice.id,
      paidAt: invoice.paidAt,
    });
  }

  return ctx.json({
    valid: true,
    invoiceId: invoice.id,
    amount: invoice.totalAmount,
    periodEnd: invoice.periodEnd,
  });
}
