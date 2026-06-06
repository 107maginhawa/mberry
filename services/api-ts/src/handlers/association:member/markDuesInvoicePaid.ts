import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { MarkDuesInvoicePaidBody, MarkDuesInvoicePaidParams } from '@/generated/openapi/validators';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { membershipLifecycle } from './utils/membership-lifecycle';

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

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);
  const orgId = ctx.get('organizationId') as string;

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');
  if (invoice.organizationId !== orgId) throw new ForbiddenError();

  const payableStatuses = ['generated', 'sent', 'overdue'];
  if (!payableStatuses.includes(invoice.status)) {
    throw new BusinessLogicError(
      `Cannot mark invoice as paid with status '${invoice.status}'. Must be generated, sent, or overdue.`,
      'INVOICE_NOT_PAYABLE',
    );
  }

  const updatedInvoice = await db.transaction(async (tx: DatabaseInstance) => {
    const txInvoiceRepo = new DuesInvoiceRepository(tx, logger);

    const marked = await txInvoiceRepo.markPaid(invoiceId, invoice.version, body.paymentId, new Date());

    // [BR-07] Extend dues_expiry_date using lifecycle service
    await membershipLifecycle.extendMembershipExpiry(tx, {
      membershipId: invoice.membershipId,
      orgId: invoice.organizationId,
    });

    return marked;
  });

  ctx.set('auditResourceId', invoiceId);
  ctx.set('auditDescription', 'Dues invoice marked as paid');

  return ctx.json(updatedInvoice, 200);
}
