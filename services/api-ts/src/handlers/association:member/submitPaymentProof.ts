import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { SubmitPaymentProofBody } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { formatReceiptNumber } from '@/handlers/dues/utils/receipt-number';
import { auditAction } from '@/utils/audit';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * submitPaymentProof
 *
 * Path: POST /association/member/dues-payments/submit-proof
 * OperationId: submitPaymentProof
 *
 * Member submits a dues payment with proof of transfer (GCash/bank screenshot).
 * Creates payment with status 'submitted', awaiting officer review.
 */
export async function submitPaymentProof(
  ctx: ValidatedContext<SubmitPaymentProofBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(body.proofMimeType)) {
    throw new BusinessLogicError(
      `Invalid proof file type '${body.proofMimeType}'. Allowed: JPEG, PNG, PDF.`,
      'INVALID_PROOF_TYPE',
    );
  }

  // Verify invoice exists and belongs to this member
  const invoiceRepo = new DuesInvoiceRepository(db);
  const invoice = await invoiceRepo.findOneById(body.invoiceId);
  if (!invoice) {
    throw new BusinessLogicError('Invoice not found', 'INVOICE_NOT_FOUND');
  }
  if (invoice.personId !== personId) {
    throw new BusinessLogicError(
      'Cannot submit proof for another member\'s invoice',
      'INVOICE_NOT_OWNED',
    );
  }

  // Invoice must be unpaid
  const payableStatuses = ['generated', 'sent', 'overdue'];
  if (!payableStatuses.includes(invoice.status)) {
    throw new BusinessLogicError(
      `Invoice already ${invoice.status}. Cannot submit proof.`,
      'INVOICE_NOT_PAYABLE',
    );
  }

  // Generate receipt number
  const repo = new DuesRepository(db);
  const year = new Date().getFullYear();
  const sequence = await repo.getNextReceiptSequence(orgId, year);
  const receiptNumber = formatReceiptNumber('ORG', year, sequence);

  const payment = await repo.createPayment({
    organizationId: orgId,
    personId,
    receiptNumber,
    amount: body.amount,
    currency: body.currency ?? 'PHP',
    paymentMethod: body.paymentMethod,
    referenceNumber: body.referenceNumber,
    invoiceId: body.invoiceId,
    status: 'submitted',
    proofStorageKey: body.proofStorageKey,
    proofFileName: body.proofFileName,
    proofMimeType: body.proofMimeType,
    paidAt: new Date(),
    createdBy: personId,
    updatedBy: personId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-payment-proof',
    resourceId: payment.id,
    description: 'Payment proof submitted for review',
  });

  return ctx.json({
    ...payment,
    proof: {
      paymentId: payment.id,
      storageKey: body.proofStorageKey,
      fileName: body.proofFileName,
      mimeType: body.proofMimeType,
      uploadedAt: new Date().toISOString(),
    },
  }, 201);
}
