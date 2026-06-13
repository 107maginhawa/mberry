import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { ConfirmPaymentProofBody, ConfirmPaymentProofParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import type { DuesPayment } from '@/handlers/association:member/repos/dues-payments.schema';
import { settlePayment } from '@/handlers/association:member/utils/settle-payment';
import { requirePosition } from '@/core/auth/officer-checks';
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

  const { DuesInvoiceRepository } = await import('@/handlers/association:member/repos/dues.repo');

  // [FIX-010] Wrap settle + status update + invoice markPaid in ONE
  // transaction (mirrors recordDuesPayment). Previously settle ran in its own
  // inner transaction and the status update + invoice markPaid ran OUTSIDE any
  // transaction, with a bare `catch {}` swallowing invoice failures — a failure
  // between steps left membership expiry extended while the payment was stuck
  // 'submitted' (silent financial-state corruption). Now any failure rolls the
  // whole unit back, and invoice-markPaid failures surface instead of being lost.
  const { settlement, updatedPayment } = await db.transaction(async (tx: DatabaseInstance) => {
    const txRepo = new DuesRepository(tx);

    // Settle: fund allocation + expiry extension (reuse the outer tx).
    const settle = await settlePayment({
      db,
      orgId,
      personId: payment.personId,
      paymentId: payment.id,
      amount: payment.amount,
      tx,
    });

    // Update payment status to confirmed (inside the tx).
    const updated = await txRepo.updatePaymentStatus(payment.id, payment.status, 'confirmed', {
      recordedBy: session.user.id,
      membershipExtendedFrom: settle.membershipExtendedFrom,
      membershipExtendedTo: settle.membershipExtendedTo,
    } as Partial<DuesPayment>, session.user.id);

    // Mark linked invoice as paid if present (inside the tx). Failures now
    // propagate and roll the whole confirmation back instead of being swallowed.
    if (payment.invoiceId) {
      const txInvoiceRepo = new DuesInvoiceRepository(tx);
      const invoice = await txInvoiceRepo.findOneById(payment.invoiceId);
      if (invoice) {
        await txInvoiceRepo.markPaid(payment.invoiceId, invoice.version, payment.id, new Date());
      }
    }

    return { settlement: settle, updatedPayment: updated };
  });

  ctx.set('auditResourceId', payment.id);
  ctx.set('auditDescription', 'Payment proof confirmed by officer');

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
