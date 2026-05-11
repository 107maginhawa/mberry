import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { MarkDuesInvoicePaidBody, MarkDuesInvoicePaidParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { MembershipRepository } from './repos/membership.repo';
import { computeNewExpiry } from '@/handlers/dues/utils/expiry-extension';
import { auditAction } from '@/utils/audit';

/**
 * markDuesInvoicePaid
 *
 * Path: POST /association/member/dues-invoices/{invoiceId}/mark-paid
 * OperationId: markDuesInvoicePaid
 *
 * [BR-07] Uses computeNewExpiry() for correct billing-cycle-aware extension
 * instead of hardcoded +1 year.
 */
export async function markDuesInvoicePaid(
  ctx: ValidatedContext<MarkDuesInvoicePaidBody, never, MarkDuesInvoicePaidParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');

  const payableStatuses = ['generated', 'sent', 'overdue'];
  if (!payableStatuses.includes(invoice.status)) {
    throw new BusinessLogicError(
      `Cannot mark invoice as paid with status '${invoice.status}'. Must be generated, sent, or overdue.`,
      'INVOICE_NOT_PAYABLE',
    );
  }

  const updatedInvoice = await invoiceRepo.markPaid(invoiceId, body.paymentId, new Date());

  // [BR-07] Extend dues_expiry_date using computeNewExpiry (not hardcoded +1 year)
  const membershipRepo = new MembershipRepository(db, logger);
  const membership = await membershipRepo.findOneById(invoice.membershipId);
  if (membership) {
    const currentExpiry = membership.duesExpiryDate
      ? new Date(membership.duesExpiryDate)
      : null;
    const newExpiry = computeNewExpiry({
      currentExpiry,
      billingCycle: 'annual', // default — no billingCycle column yet
    });
    const newExpiryDate = newExpiry.toISOString().split('T')[0]!;

    await membershipRepo.updateOneById(invoice.membershipId, {
      duesExpiryDate: newExpiryDate,
      status: 'active',
    } as any);
  }

  await auditAction(ctx, {
    action: 'mark-paid',
    resourceType: 'dues-invoice',
    resourceId: invoiceId,
    description: 'Dues invoice marked as paid',
  });

  return ctx.json(updatedInvoice, 200);
}
