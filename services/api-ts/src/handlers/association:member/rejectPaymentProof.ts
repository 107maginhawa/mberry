import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { RejectPaymentProofBody, RejectPaymentProofParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * rejectPaymentProof
 *
 * Path: POST /association/member/dues-payments/{paymentId}/reject
 * OperationId: rejectPaymentProof
 *
 * Officer rejects a submitted payment proof with reason.
 * No fund allocation or expiry extension. Member sees reason and can resubmit.
 */
export async function rejectPaymentProof(
  ctx: ValidatedContext<RejectPaymentProofBody, never, RejectPaymentProofParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { paymentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const orgId = ctx.get('orgId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('DuesPayment');

  if (payment.status !== 'submitted') {
    throw new BusinessLogicError(
      `Cannot reject payment with status '${payment.status}'. Must be 'submitted'.`,
      'PAYMENT_NOT_SUBMITTED',
    );
  }

  if (payment.organizationId !== orgId) {
    throw new BusinessLogicError(
      'Payment does not belong to this organization',
      'PAYMENT_ORG_MISMATCH',
    );
  }

  const updatedPayment = await repo.updatePaymentStatus(payment.id, 'rejected', {
    rejectionReason: body.reason,
    recordedBy: session.user.id,
  } as any);

  await auditAction(ctx, {
    action: 'deny',
    resourceType: 'dues-payment-proof',
    resourceId: payment.id,
    description: `Payment proof rejected: ${body.reason}`,
  });

  return ctx.json({
    ...updatedPayment,
    rejectionReason: body.reason,
    proof: payment.proofStorageKey ? {
      paymentId: payment.id,
      storageKey: payment.proofStorageKey,
      fileName: payment.proofFileName,
      mimeType: payment.proofMimeType,
      uploadedAt: payment.paidAt?.toISOString() ?? new Date().toISOString(),
    } : undefined,
  }, 200);
}
