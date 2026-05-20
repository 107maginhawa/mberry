/**
 * Update Invoice Handler
 *
 * Updates an existing invoice (draft only).
 * Follows TypeSpec billing.tsp definition with current schema adaptation.
 */

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { UpdateInvoiceBody, UpdateInvoiceParams } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import { InvoiceRepository } from './repos/billing.repo';

/**
 * updateInvoice
 *
 * Path: PATCH /invoices/{invoice}
 * OperationId: updateInvoice
 *
 * Update an existing invoice (draft only)
 */
export async function updateInvoice(
  ctx: ValidatedContext<UpdateInvoiceBody, never, UpdateInvoiceParams>
): Promise<Response> {
  const database = ctx.get('database');
  const logger = ctx.get('logger');

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract validated parameters and body
  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const invoiceId = params.invoice;

  logger.info({
    invoiceId,
    userId: user.id,
    updateFields: Object.keys(body)
  }, 'Updating invoice');

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
    throw new ForbiddenError('Only admins or the merchant can update invoices');
  }

  // Business rule: only draft invoices can be updated
  if (invoice.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot update invoice: invoice is in ${invoice.status} state, only draft invoices can be modified`,
      'INVALID_INVOICE_STATUS'
    );
  }

  // Build update data
  const updateData: any = {
    updatedBy: user.id
  };

  // Handle payment due date update
  if (body.paymentDueAt !== undefined) {
    updateData.paymentDueAt = body.paymentDueAt ? new Date(body.paymentDueAt) : null;
  }

  // Handle paymentCaptureMethod update
  if (body.paymentCaptureMethod !== undefined) {
    updateData.paymentCaptureMethod = body.paymentCaptureMethod;
  }

  // Handle voidThresholdMinutes update
  if (body.voidThresholdMinutes !== undefined) {
    updateData.voidThresholdMinutes = body.voidThresholdMinutes;
  }

  // Handle metadata update
  if (body.metadata !== undefined) {
    updateData.metadata = body.metadata;
  }

  // Handle line items update
  if (body.lineItems) {
    // Validate line items
    if (body.lineItems.length === 0) {
      throw new ValidationError('At least one line item is required');
    }

    // Calculate new amounts
    let subtotal = 0;
    const processedLineItems = body.lineItems.map((item: any) => {
      const amount = (item.quantity || 1) * item.unitPrice;
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        amount,
        metadata: item.metadata
      };
    });

    const tax = 0; // TODO: Calculate tax based on jurisdiction
    const total = subtotal + tax;

    // Update totals
    updateData.subtotal = subtotal;
    updateData.tax = tax || undefined;
    updateData.total = total;
  }

  // Update invoice
  const updatedInvoice = await invoiceRepo.updateOneById(invoiceId, updateData);

  logger.info({
    invoiceId,
    invoiceNumber: updatedInvoice.invoiceNumber,
    changes: Object.keys(updateData),
    newAmount: (updatedInvoice as Record<string, unknown>)['amount']
  }, 'Invoice updated successfully');

  // Fetch updated invoice with line items for complete response
  const invoiceWithLineItems = await invoiceRepo.findOneWithLineItems(invoiceId);

  // Format response to match TypeSpec Invoice model
  const response = {
    id: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    customer: updatedInvoice.customer,
    merchant: updatedInvoice.merchant,
    context: updatedInvoice.context || null,
    status: updatedInvoice.status,
    subtotal: updatedInvoice.subtotal,
    tax: updatedInvoice.tax || null,
    total: updatedInvoice.total,
    currency: updatedInvoice.currency,
    paymentCaptureMethod: updatedInvoice.paymentCaptureMethod,
    paymentDueAt: updatedInvoice.paymentDueAt?.toISOString() || null,
    lineItems: ((invoiceWithLineItems as Record<string, unknown> | null)?.['lineItems'] as Array<Record<string, unknown>> || []).map((item: Record<string, unknown>) => ({
      description: item['description'],
      quantity: item['quantity'],
      unitPrice: item['unitPrice'],
      amount: item['amount'],
      metadata: item['metadata'] || null
    })),
    paymentStatus: updatedInvoice.paymentStatus || null,
    paidAt: updatedInvoice.paidAt?.toISOString() || null,
    paidBy: updatedInvoice.paidBy || null,
    voidedAt: updatedInvoice.voidedAt?.toISOString() || null,
    voidedBy: updatedInvoice.voidedBy || null,
    voidThresholdMinutes: updatedInvoice.voidThresholdMinutes || null,
    authorizedAt: updatedInvoice.authorizedAt?.toISOString() || null,
    authorizedBy: updatedInvoice.authorizedBy || null,
    metadata: updatedInvoice.metadata || null,
    createdAt: updatedInvoice.createdAt.toISOString(),
    updatedAt: updatedInvoice.updatedAt.toISOString()
  };

  return ctx.json(response, 200);
}