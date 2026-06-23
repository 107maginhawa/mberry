/**
 * Create Invoice Handler
 *
 * Creates a new invoice for billing purposes.
 * Follows TypeSpec billing.tsp definition with TypeSpec-aligned schema.
 */

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { CreateInvoiceBody } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import { InvoiceRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
// Customer and merchant are both persons in monobase
import type { CreateInvoiceRequest } from './repos/billing.schema';

/**
 * createInvoice
 *
 * Path: POST /invoices
 * OperationId: createInvoice
 *
 * Create a new invoice for billing purposes (TypeSpec-aligned)
 */
export async function createInvoice(
  ctx: ValidatedContext<CreateInvoiceBody, never, never>
): Promise<Response> {
  const database = ctx.get('database');
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'billing' }) ?? baseLogger;

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract validated request body (TypeSpec-aligned)
  const body = ctx.req.valid('json') as CreateInvoiceRequest;
  const {
    customer,
    merchant,
    context,
    currency = 'USD',
    paymentCaptureMethod = 'automatic',
    paymentDueAt,
    voidThresholdMinutes,
    lineItems,
    metadata
  } = body;

  // Multi-tenant scoping (P0-7). The /billing/* org-context middleware is
  // fail-open — it only populates organizationId when the session user is an
  // active member of the x-org-id org. A non-member (or a request missing
  // org context) leaves it undefined, which would otherwise insert a NULL
  // organization_id and surface as a raw 500. Guard with a clean 400.
  const organizationId = ctx.get('organizationId') as string | undefined;
  if (!organizationId) {
    throw new ValidationError(
      'Organization context is required to create an invoice. Provide x-org-id for an organization you belong to.'
    );
  }

  logger.info({ action: 'createInvoice.1',
    customer,
    merchant,
    context,
    organizationId,
    lineItemCount: lineItems?.length || 0
  }, 'Creating new invoice');

  // Create repository instances
  const invoiceRepo = new InvoiceRepository(database, logger);
  const personRepo = new PersonRepository(database, logger);
  

  // Check provider exists and user has access
  const merchantPerson = await personRepo.findOneById(merchant);
  if (!merchantPerson) {
    throw new NotFoundError('Merchant person not found', {
      resourceType: 'person',
      resource: merchant,
      suggestions: ['Check merchant person ID format', 'Verify merchant person exists in system']
    });
  }

  // Check patient exists
  const customerPerson = await personRepo.findOneById(customer);
  if (!customerPerson) {
    throw new NotFoundError('Customer person not found', {
      resourceType: 'person',
      resource: customer,
      suggestions: ['Check customer person ID format', 'Verify customer person exists in system']
    });
  }

  // Authorization check: must be the merchant or admin
  const userRoles = user.role ? user.role.split(',').map((r: string) => r.trim()) : [];
  const isAdmin = userRoles.includes('admin');

  if (!isAdmin && merchant !== user.id) {
    throw new ForbiddenError('Only admins or the merchant can create invoices');
  }

  // Validate line items
  if (!lineItems || lineItems.length === 0) {
    throw new ValidationError('At least one line item is required');
  }

  // Check for duplicate context if provided
  if (context) {
    const existingInvoice = await invoiceRepo.findMany({ context });
    const firstInvoice = existingInvoice[0];
    if (firstInvoice) {
      throw new ConflictError('Invoice with this context already exists');
    }
  }

  // Calculate amounts (TypeSpec uses integers for cents)
  let subtotal = 0;
  const processedLineItems = lineItems.map((item) => {
    const quantity = item.quantity || 1;
    const amount = quantity * item.unitPrice;
    subtotal += amount;
    return {
      description: item.description,
      quantity,
      unitPrice: item.unitPrice,
      amount,
      metadata: item.metadata
    };
  });

  const tax = 0; // Deferred: tax calculation by jurisdiction — billing v2. Tracked: GAP-BACKLOG.md
  const total = subtotal + tax;

  // Create invoice with line items using transaction
  const invoiceWithLineItems = await invoiceRepo.createWithLineItems(
    {
      organizationId,
      customer,
      merchant,
      context,
      status: 'draft',
      subtotal,
      tax: tax || undefined,
      total,
      currency,
      paymentCaptureMethod,
      paymentDueAt: paymentDueAt ? new Date(paymentDueAt) : undefined,
      voidThresholdMinutes,
      metadata,
      createdBy: user.id
    },
    processedLineItems
  );

  logger.info({ action: 'createInvoice.2',
    invoiceId: invoiceWithLineItems.id,
    invoiceNumber: invoiceWithLineItems.invoiceNumber,
    merchant,
    customer,
    total: invoiceWithLineItems.total
  }, 'Invoice created successfully');

  ctx.set('auditResourceId', invoiceWithLineItems.id);
  ctx.set('auditDescription', `Invoice ${invoiceWithLineItems.invoiceNumber} created: ${currency} ${total}`);
  ctx.set('auditDetails', { invoiceNumber: invoiceWithLineItems.invoiceNumber, customer, merchant, total });

  // Return response matching TypeSpec Invoice model structure
  return ctx.json({
    id: invoiceWithLineItems.id,
    invoiceNumber: invoiceWithLineItems.invoiceNumber,
    customer,
    merchant,
    merchantAccount: invoiceWithLineItems.merchantAccount,
    context: invoiceWithLineItems.context,
    status: invoiceWithLineItems.status,
    subtotal: invoiceWithLineItems.subtotal,
    tax: invoiceWithLineItems.tax,
    total: invoiceWithLineItems.total,
    currency: invoiceWithLineItems.currency,
    paymentCaptureMethod: invoiceWithLineItems.paymentCaptureMethod,
    paymentDueAt: invoiceWithLineItems.paymentDueAt?.toISOString() || null,
    paymentStatus: invoiceWithLineItems.paymentStatus,
    paidAt: invoiceWithLineItems.paidAt?.toISOString() || null,
    paidBy: invoiceWithLineItems.paidBy,
    voidedAt: invoiceWithLineItems.voidedAt?.toISOString() || null,
    voidedBy: invoiceWithLineItems.voidedBy,
    voidThresholdMinutes: invoiceWithLineItems.voidThresholdMinutes,
    authorizedAt: invoiceWithLineItems.authorizedAt?.toISOString() || null,
    authorizedBy: invoiceWithLineItems.authorizedBy,
    lineItems: invoiceWithLineItems.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata
    })),
    metadata: invoiceWithLineItems.metadata,
    createdAt: invoiceWithLineItems.createdAt.toISOString(),
    updatedAt: invoiceWithLineItems.updatedAt.toISOString(),
    version: invoiceWithLineItems.version
  }, 201);
}