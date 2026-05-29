/**
 * Finalize Invoice Handler
 *
 * Finalizes an invoice (changes from draft to open status).
 * Follows TypeSpec billing.tsp definition with current schema adaptation.
 */

import {
  ForbiddenError,
  NotFoundError,
  BusinessLogicError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { FinalizeInvoiceParams } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import { InvoiceRepository } from './repos/billing.repo';
import { auditAction } from '@/utils/audit';

/**
 * finalizeInvoice
 *
 * Path: POST /invoices/{invoice}/finalize
 * OperationId: finalizeInvoice
 *
 * Finalize an invoice (draft to open)
 */
export async function finalizeInvoice(
  ctx: ValidatedContext<never, never, FinalizeInvoiceParams>
): Promise<Response> {
  const database = ctx.get('database');
  const logger = ctx.get('logger');

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract validated parameters
  const params = ctx.req.valid('param');
  const invoiceId = params.invoice;

  logger.info({ invoiceId, userId: user.id }, 'Finalizing invoice');

  // Create repository instance
  const invoiceRepo = new InvoiceRepository(database, logger);

  // Get existing invoice
  const invoice = await invoiceRepo.findOneById(invoiceId);

  if (!invoice) {
    throw new NotFoundError('Invoice not found', {
      resourceType: 'invoice',
      resource: invoiceId,
      suggestions: ['Check invoice ID format', 'Verify invoice exists in system']
    });
  }

  // Authorization check: must be the merchant or admin
  const userRoles = user.role ? user.role.split(',').map((r: string) => r.trim()) : [];
  const isAdmin = userRoles.includes('admin');

  if (!isAdmin && invoice.merchant !== user.id) {
    throw new ForbiddenError('Only admins or the merchant can finalize invoices');
  }

  // Business rule: only draft invoices can be finalized
  if (invoice.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot finalize invoice: invoice is in ${invoice.status} state, only draft invoices can be finalized`,
      'INVALID_INVOICE_STATUS'
    );
  }

  // Validate invoice has required data before finalizing
  if (!invoice.total || invoice.total <= 0) {
    throw new BusinessLogicError(
      'Cannot finalize invoice: invoice must have a positive total amount',
      'INCOMPLETE_INVOICE_DATA'
    );
  }

  // Update invoice status to open and set issued timestamp
  await invoiceRepo.updateStatus(invoiceId, 'open', user.id);

  // Fetch fresh invoice with line items for complete response
  const finalizedInvoice = await invoiceRepo.findOneWithLineItems(invoiceId);
  if (!finalizedInvoice) {
    throw new NotFoundError('Finalized invoice not found', {
      resourceType: 'invoice',
      resource: invoiceId
    });
  }

  logger.info({
    invoiceId,
    invoiceNumber: finalizedInvoice.invoiceNumber,
    merchantId: finalizedInvoice.merchant,
    customerId: finalizedInvoice.customer,
    total: finalizedInvoice.total,
    status: finalizedInvoice.status
  }, 'Invoice finalized successfully');

  await auditAction(ctx, {
    action: 'finalize',
    resourceType: 'invoice',
    resourceId: invoiceId,
    description: `Invoice ${finalizedInvoice.invoiceNumber} finalized (${finalizedInvoice.total} ${finalizedInvoice.currency})`,
    eventSubType: 'financial.invoice-finalized',
    details: {
      invoiceNumber: finalizedInvoice.invoiceNumber,
      total: finalizedInvoice.total,
      currency: finalizedInvoice.currency,
      customerId: finalizedInvoice.customer,
      merchantId: finalizedInvoice.merchant,
    },
  });

  // Format response to match TypeSpec Invoice model
  const response = {
    id: finalizedInvoice.id,
    invoiceNumber: finalizedInvoice.invoiceNumber,
    customer: finalizedInvoice.customer,
    merchant: finalizedInvoice.merchant,
    context: finalizedInvoice.context || null,
    status: finalizedInvoice.status,
    subtotal: finalizedInvoice.subtotal,
    tax: finalizedInvoice.tax || null,
    total: finalizedInvoice.total,
    currency: finalizedInvoice.currency,
    paymentCaptureMethod: finalizedInvoice.paymentCaptureMethod,
    paymentDueAt: finalizedInvoice.paymentDueAt?.toISOString() || null,
    lineItems: (finalizedInvoice.lineItems || []).map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata || null
    })),
    paymentStatus: finalizedInvoice.paymentStatus || null,
    paidAt: finalizedInvoice.paidAt?.toISOString() || null,
    paidBy: finalizedInvoice.paidBy || null,
    voidedAt: finalizedInvoice.voidedAt?.toISOString() || null,
    voidedBy: finalizedInvoice.voidedBy || null,
    voidThresholdMinutes: finalizedInvoice.voidThresholdMinutes || null,
    authorizedAt: finalizedInvoice.authorizedAt?.toISOString() || null,
    authorizedBy: finalizedInvoice.authorizedBy || null,
    metadata: finalizedInvoice.metadata || null,
    createdAt: finalizedInvoice.createdAt.toISOString(),
    updatedAt: finalizedInvoice.updatedAt.toISOString()
  };

  return ctx.json(response, 200);
}
