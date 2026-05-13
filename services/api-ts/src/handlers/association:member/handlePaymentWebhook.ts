import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { PayMongoAdapter } from './utils/paymongo.adapter';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { auditAction } from '@/utils/audit';

/**
 * handlePaymentWebhook
 *
 * Public endpoint — receives payment gateway webhooks.
 * Idempotent: if invoice already paid, acknowledge without re-processing (M6-R8).
 * No auth required (webhook signature verification instead).
 */
export async function handlePaymentWebhook(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const body = await ctx.req.text();
  const signature = ctx.req.header('paymongo-signature') || '';

  const secretKey = process.env['PAYMONGO_SECRET_KEY'];
  const webhookSecret = process.env['PAYMONGO_WEBHOOK_SECRET'];

  if (!secretKey || !webhookSecret) {
    return ctx.json({ error: 'Payment gateway not configured' }, 503);
  }

  const adapter = new PayMongoAdapter(secretKey, webhookSecret);
  const event = adapter.verifyWebhook(body, signature);

  if (!event) {
    return ctx.json({ error: 'Invalid webhook signature' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoiceId = event.metadata['duesInvoiceId'];
  if (!invoiceId) {
    return ctx.json({ received: true, action: 'ignored' });
  }

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) {
    logger?.warn({ invoiceId, eventId: event.gatewayEventId }, 'Webhook for unknown invoice');
    return ctx.json({ received: true, action: 'unknown_invoice' });
  }

  // Idempotency: already paid → acknowledge
  if (invoice.status === 'paid') {
    return ctx.json({ received: true, action: 'already_paid' });
  }

  if (event.status === 'paid') {
    await invoiceRepo.markPaid(invoice.id, invoice.version, event.gatewayEventId, new Date());

    await auditAction(ctx, {
      action: 'mark-paid',
      resourceType: 'dues-invoice',
      resourceId: invoice.id,
      description: `Online payment via PayMongo: ${event.gatewayEventId}`,
      details: { gatewayEventId: event.gatewayEventId, amount: event.amount },
    });
  }

  return ctx.json({ received: true, action: event.status === 'paid' ? 'processed' : 'noted' });
}
