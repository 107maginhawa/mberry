import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { RecordDuesPaymentBody } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { formatReceiptNumber } from '@/handlers/dues/utils/receipt-number';
import { settlePayment } from '@/handlers/dues/utils/settle-payment';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
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
  const orgId = ctx.get('orgId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  // [BR-06] Concurrent payment guard
  const recentPayment = await repo.findRecentPaymentForPerson(orgId, body.personId);
  const hasConcurrentWarning = !!recentPayment;

  // Generate receipt number in org sequence
  const year = new Date().getFullYear();
  const sequence = await repo.getNextReceiptSequence(orgId, year);
  const receiptNumber = formatReceiptNumber('ORG', year, sequence);

  const payment = await repo.createPayment({
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

  // [BR-06 + BR-07] Fund allocation + membership expiry extension
  const settlement = await settlePayment({
    db,
    orgId,
    personId: body.personId,
    paymentId: payment.id,
    amount: body.amount,
  });

  // Update payment with extension dates
  if (settlement.membershipExtendedTo) {
    await repo.updatePaymentStatus(payment.id, 'completed', {
      membershipExtendedFrom: settlement.membershipExtendedFrom,
      membershipExtendedTo: settlement.membershipExtendedTo,
    } as any);
  }

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-payment',
    resourceId: payment.id,
    description: 'Dues payment recorded',
  });

  return ctx.json({
    ...payment,
    receiptNumber,
    fundAllocations: settlement.fundAllocations,
    membershipExtendedFrom: settlement.membershipExtendedFrom,
    membershipExtendedTo: settlement.membershipExtendedTo,
    meta: { concurrentWarning: hasConcurrentWarning, recentPayment },
  }, 201);
}
