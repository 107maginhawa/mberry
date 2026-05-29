import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { ConfirmPaymentProofBody, ConfirmPaymentProofParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues-payments.repo';
import type { DuesPayment } from './repos/dues-payments.schema';
import { settlePayment } from './utils/settle-payment';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * confirmPaymentProof
 *
 * Path: POST /association/member/dues-payments/{paymentId}/confirm
 * OperationId: confirmPaymentProof
 *
 * Officer confirms a submitted payment proof.
 * Triggers fund allocation + membership expiry extension via settlePayment().
 */
export async function confirmPaymentProof(
  ctx: ValidatedContext<ConfirmPaymentProofBody, never, ConfirmPaymentProofParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { paymentId } = ctx.req.valid('param');
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  // Fetch payment
  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('DuesPayment');

  // Must be in 'submitted' status
  if (payment.status !== 'submitted') {
    throw new BusinessLogicError(
      `Cannot confirm payment with status '${payment.status}'. Must be 'submitted'.`,
      'PAYMENT_NOT_SUBMITTED',
    );
  }

  // Must belong to this org
  if (payment.organizationId !== orgId) {
    throw new BusinessLogicError(
      'Payment does not belong to this organization',
      'PAYMENT_ORG_MISMATCH',
    );
  }

  // Settle: fund allocation + expiry extension
  const settlement = await settlePayment({
    db,
    orgId,
    personId: payment.personId,
    paymentId: payment.id,
    amount: payment.amount,
  });

  // Update payment status to confirmed
  const updatedPayment = await repo.updatePaymentStatus(payment.id, payment.status, 'confirmed', {
    recordedBy: session.user.id,
    membershipExtendedFrom: settlement.membershipExtendedFrom,
    membershipExtendedTo: settlement.membershipExtendedTo,
  } as Partial<DuesPayment>, session.user.id);

  // Mark linked invoice as paid if present
  if (payment.invoiceId) {
    const { DuesInvoiceRepository } = await import('./repos/dues.repo');
    const invoiceRepo = new DuesInvoiceRepository(db);
    try {
      const invoice = await invoiceRepo.findOneById(payment.invoiceId);
      if (invoice) {
        await invoiceRepo.markPaid(payment.invoiceId, invoice.version, payment.id, new Date());
      }
    } catch {
      // Invoice may already be paid — non-fatal
    }
  }

  await auditAction(ctx, {
    action: 'approve',
    resourceType: 'dues-payment-proof',
    resourceId: payment.id,
    description: 'Payment proof confirmed by officer',
  });

  return ctx.json({
    ...updatedPayment,
    fundAllocations: settlement.fundAllocations,
    membershipExtendedFrom: settlement.membershipExtendedFrom,
    membershipExtendedTo: settlement.membershipExtendedTo,
    proof: payment.proofStorageKey ? {
      paymentId: payment.id,
      storageKey: payment.proofStorageKey,
      fileName: payment.proofFileName,
      mimeType: payment.proofMimeType,
      uploadedAt: payment.paidAt?.toISOString() ?? new Date().toISOString(),
    } : undefined,
  }, 200);
}
