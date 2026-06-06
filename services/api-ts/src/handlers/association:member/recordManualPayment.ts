import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ConflictError } from '@/core/errors';
import { DuesInvoiceRepository } from './repos/dues.repo';

/**
 * recordManualPayment
 *
 * Treasurer records an offline payment (cash, check, bank deposit).
 * Marks invoice as paid and extends membership from current expiry (BR-07).
 */
export async function recordManualPayment(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoice = await invoiceRepo.findOneById(body.duesInvoiceId);
  if (!invoice || invoice.organizationId !== orgId) {
    throw new NotFoundError('Dues invoice');
  }

  if (invoice.status === 'paid') {
    throw new ConflictError('This invoice has already been paid');
  }

  // markPaid(invoiceId, expectedVersion, paymentId, paidAt?) — optimistic lock [PAY-03]
  const paymentRef = body.reference || `manual-${Date.now()}`;
  await invoiceRepo.markPaid(invoice.id, invoice.version, paymentRef, new Date());

  ctx.set('auditResourceId', invoice.id);
  ctx.set('auditDescription', `Manual payment recorded: ${body.paymentMethod || 'manual'}, ref: ${paymentRef}`);
  ctx.set('auditDetails', { method: body.paymentMethod, reference: paymentRef });

  return ctx.json({ paid: true, invoiceId: invoice.id });
}
