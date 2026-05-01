import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { createPaymentToken } from './utils/payment-token';
import { auditAction } from '@/utils/audit';

/**
 * generatePaymentLink
 *
 * Creates an HMAC-signed public payment link for a dues invoice.
 * 30-day validity.
 */
export async function generatePaymentLink(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoice = await invoiceRepo.findOneById(body.duesInvoiceId);
  if (!invoice || invoice.tenantId !== tenantId) {
    throw new NotFoundError('Dues invoice');
  }

  if (invoice.status === 'paid') {
    return ctx.json({ error: 'Invoice already paid' }, 409);
  }

  const secret = process.env['PAYMENT_LINK_SECRET'] || 'dev-payment-link-secret';
  const token = createPaymentToken(invoice.id, tenantId, secret);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'payment-link',
    resourceId: invoice.id,
    description: `Payment link generated for invoice ${invoice.id}`,
  });

  return ctx.json({
    token,
    invoiceId: invoice.id,
    amount: invoice.totalAmount,
    expiresAt: expiresAt.toISOString(),
  }, 201);
}
