import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import type { RecordDuesPaymentBody } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import type { DuesPayment } from '@/handlers/association:member/repos/dues-payments.schema';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { formatReceiptNumber } from '@/handlers/association:member/utils/receipt-number';
import { settlePayment } from '@/handlers/association:member/utils/settle-payment';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * recordDuesPayment
 *
 * Path: POST /association/member/dues-payments
 * OperationId: recordDuesPayment
 *
 * Records a manual dues payment: generates receipt, allocates funds,
 * extends membership expiry via computeNewExpiry, and flags concurrent warnings.
 */
export async function recordDuesPayment(
  ctx: ValidatedContext<RecordDuesPaymentBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  // [BR-06] Concurrent payment guard (read-only, safe outside transaction)
  const recentPayment = await repo.findRecentPaymentForPerson(orgId, body.personId);
  const hasConcurrentWarning = !!recentPayment;

  // Generate receipt number in org sequence.
  // [FIX-003] Per-org prefix + atomic per-org/year counter (no cross-org collision).
  const year = new Date().getFullYear();
  const orgPrefix = await repo.getOrgReceiptPrefix(orgId);
  const sequence = await repo.getNextReceiptSequence(orgId, year);
  const receiptNumber = formatReceiptNumber(orgPrefix, year, sequence);

  // [PAY-01][PAY-03] Pre-validate invoice outside transaction (read-only).
  // Backend reads version from DB — never from client — to prevent lock bypass (T-20-02).
  let invoiceForLocking: { version: number } | null = null;
  if (body.invoiceId) {
    const invoiceRepo = new DuesInvoiceRepository(db, ctx.get('logger'));
    const invoice = await invoiceRepo.findOneById(body.invoiceId);
    if (!invoice) throw new NotFoundError('DuesInvoice');
    if (invoice.organizationId !== orgId) throw new ForbiddenError();  // T-20-03 cross-org guard
    const payableStatuses = ['generated', 'sent', 'overdue'];
    if (!payableStatuses.includes(invoice.status)) {
      throw new BusinessLogicError(
        `Cannot pay invoice with status '${invoice.status}'`,
        'INVOICE_NOT_PAYABLE',
      );
    }
    invoiceForLocking = { version: invoice.version };
  }

  // Wrap payment creation + settlement in a single transaction so
  // if settlement fails the payment row does not persist.
  const { payment, settlement } = await db.transaction(async (txDb: DatabaseInstance) => {
    const txRepo = new DuesRepository(txDb);

    const pay = await txRepo.createPayment({
      organizationId: orgId,
      personId: body.personId,
      receiptNumber,
      amount: body.amount,
      currency: body.currency ?? 'PHP',
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber,
      invoiceId: body.invoiceId,
      status: 'completed',
      recordedBy: session.user.id,
      paidAt: new Date(),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    // [PAY-01] Mark linked invoice as paid atomically inside the same transaction.
    // Uses optimistic lock (version read before transaction) to prevent double-payment [PAY-03].
    if (body.invoiceId && invoiceForLocking) {
      const txInvoiceRepo = new DuesInvoiceRepository(txDb, ctx.get('logger'));
      await txInvoiceRepo.markPaid(body.invoiceId, invoiceForLocking.version, pay.id, new Date());
    }

    // [BR-06 + BR-07] Fund allocation + membership expiry extension
    // Pass txDb so settlePayment reuses the outer transaction.
    const settle = await settlePayment({
      db,
      orgId,
      personId: body.personId,
      paymentId: pay.id,
      amount: body.amount,
      tx: txDb,
    });

    // Update payment with extension dates
    if (settle.membershipExtendedTo) {
      await txRepo.updatePaymentStatus(pay.id, pay.status, 'completed', {
        membershipExtendedFrom: settle.membershipExtendedFrom,
        membershipExtendedTo: settle.membershipExtendedTo,
      } as Partial<DuesPayment>, session.user.id);
    }

    return { payment: pay, settlement: settle };
  });

  ctx.set('auditResourceId', payment.id);
  ctx.set('auditDescription', 'Dues payment recorded');

  return ctx.json({
    ...payment,
    receiptNumber,
    fundAllocations: settlement.fundAllocations,
    membershipExtendedFrom: settlement.membershipExtendedFrom,
    membershipExtendedTo: settlement.membershipExtendedTo,
    meta: { concurrentWarning: hasConcurrentWarning, recentPayment },
  }, 201);
}
