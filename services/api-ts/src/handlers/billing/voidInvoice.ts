import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  ConflictError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { VoidInvoiceParams } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import type { InvoiceMetadata, MerchantMetadata } from './repos/billing.schema';
import { PersonRepository } from '../person/repos/person.repo';

/**
 * voidInvoice
 * 
 * Path: POST /invoices/{id}/void
 * OperationId: voidInvoice
 * 
 * Void invoice by canceling the authorized payment intent
 */
export async function voidInvoice(
  ctx: ValidatedContext<never, never, VoidInvoiceParams>
): Promise<Response> {
  const database = ctx.get('database');
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'billing' }) ?? baseLogger;
  const billing = ctx.get('billing');
  
  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  
  // Extract validated parameters (no request body for void)
  const params = ctx.req.valid('param');

  const invoiceId = params.invoice;

  logger.info({ action: 'voidInvoice.1', invoiceId }, 'Voiding invoice');
  
  // Create repository instances
  const invoiceRepo = new InvoiceRepository(database, logger);
  const merchantAccountRepo = new MerchantAccountRepository(database, logger);
  const personRepo = new PersonRepository(database, logger);

  // Get the invoice record
  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) {
    throw new NotFoundError('Invoice not found', {
      resourceType: 'invoice',
      resource: invoiceId,
      suggestions: ['Check invoice ID', 'Verify invoice exists', 'Check invoice status']
    });
  }

  // Authorization check: provider:owner or admin
  const user = session.user;
  const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
  const isAdmin = userRoles.includes('admin');

  if (!isAdmin) {
    // Non-admin users must be the provider (owner)
    // Find the provider account for the authenticated user
    const authenticatedUserPerson = await personRepo.findOneById(user.id);
    if (!authenticatedUserPerson) {
      throw new ForbiddenError('Provider account not found for authenticated user');
    }

    // Check if this provider is the merchant on the invoice
    if (authenticatedUserPerson.id !== invoice.merchant) {
      throw new ForbiddenError('You can only void your own invoices');
    }
  }

  // D-06: Void threshold enforcement
  if (invoice.voidThresholdMinutes && invoice.paidAt) {
    const minutesSincePaid = (Date.now() - invoice.paidAt.getTime()) / (1000 * 60);
    if (minutesSincePaid > invoice.voidThresholdMinutes) {
      throw new BusinessLogicError(
        `Cannot void invoice: void threshold of ${invoice.voidThresholdMinutes} minutes has passed`,
        'VOID_THRESHOLD_EXCEEDED'
      );
    }
  }

  // Terminal-state guards (Conflict 409) — cannot void an already-voided or
  // already-paid invoice, regardless of which void path applies.
  if (invoice.status === 'void' || invoice.paymentStatus === 'canceled') {
    throw new ConflictError('Payment has already been voided');
  }

  if (invoice.status === 'paid' || invoice.paymentStatus === 'succeeded') {
    throw new ConflictError('Payment has already been captured and cannot be voided');
  }

  // FIX-008 / SM-M21-INVOICE: only Draft or Open (Sent) invoices transition to
  // Void. Anything else (e.g. uncollectible) is not a voidable state.
  if (invoice.status !== 'draft' && invoice.status !== 'open') {
    throw new BusinessLogicError(
      `Cannot void invoice in ${invoice.status} state`,
      'INVOICE_NOT_VOIDABLE'
    );
  }

  const invoiceMetadata = invoice.metadata as InvoiceMetadata;

  if (invoice.paymentStatus === 'requires_capture') {
    // ── Authorized-payment void path ──────────────────────────────────────
    // A payment is authorized and held; cancel the Stripe payment intent to
    // release the held funds before voiding the invoice.
    const providerDecision = invoiceMetadata?.providerDecision;
    const stripePaymentIntentId = invoiceMetadata?.stripePaymentIntentId;

    if (providerDecision) {
      throw new ConflictError('Payment decision has already been made');
    }

    if (!stripePaymentIntentId) {
      throw new BusinessLogicError(
        'No payment intent found for this invoice',
        'PAYMENT_INTENT_MISSING'
      );
    }

    // Get the merchant account for the merchant person
    const merchantAccount = await merchantAccountRepo.findByPerson(invoice.merchant);
    if (!merchantAccount) {
      throw new NotFoundError('Merchant account not found', {
        resourceType: 'merchant-account',
        resource: invoice.merchant,
        suggestions: ['Check merchant person ID format', 'Verify merchant person exists in system', 'Complete billing setup']
      });
    }

    const merchantMetadata = merchantAccount.metadata as MerchantMetadata;
    if (!merchantMetadata?.stripeAccountId) {
      throw new BusinessLogicError(
        'Provider Stripe account not found',
        'STRIPE_ACCOUNT_MISSING'
      );
    }

    try {
      // Cancel the payment intent with Stripe
      await billing.cancelPaymentIntent(
        stripePaymentIntentId,
        merchantMetadata.stripeAccountId,
        'Voided by provider'
      );

      // Update invoice with void details in metadata
      const updatedMetadata = {
        ...invoiceMetadata,
        providerDecision: 'void',
        providerDecisionAt: new Date().toISOString(),
      };

      await invoiceRepo.updateOneById(invoiceId, {
        paymentStatus: 'canceled',
        status: 'void',
        voidedAt: new Date(),
        metadata: updatedMetadata,
      });
    } catch (error) {
      logger.error({ action: 'voidInvoice.3', error, invoiceId }, 'Failed to void invoice');

      if (error instanceof ValidationError || error instanceof ConflictError || error instanceof BusinessLogicError) {
        throw error;
      }

      throw new BusinessLogicError(
        'Failed to void invoice. Please try again later.',
        'INVOICE_VOID_ERROR'
      );
    }
  } else {
    // ── Unpaid / unauthorized void path (no charge) ───────────────────────
    // SM-M21-INVOICE Draft/Open → Void. Per billing.md, an invoice voided
    // before authorization follows the "standard void process without charge"
    // — there is no held payment intent to cancel.
    await invoiceRepo.updateOneById(invoiceId, {
      status: 'void',
      voidedAt: new Date(),
    });
  }

  logger.info(
    { action: 'voidInvoice.2', invoiceId, total: invoice.total },
    'Invoice voided successfully'
  );

  ctx.set('auditResourceId', invoiceId);
  ctx.set('auditDescription', `Invoice voided: ${invoice.invoiceNumber ?? invoiceId}`);
  ctx.set('auditDetails', { invoiceId, total: invoice.total });

  // Fetch the updated invoice to return
  const updatedInvoice = await invoiceRepo.findOneById(invoiceId);
  if (!updatedInvoice) {
    throw new NotFoundError('Updated invoice not found', {
      resourceType: 'invoice',
      resource: invoiceId
    });
  }

  // Return the full invoice as defined in TypeSpec
  // Expose safe metadata fields for client use
  const safeMetadata = updatedInvoice.metadata ? {
    stripePaymentIntentId: (updatedInvoice.metadata as InvoiceMetadata)?.stripePaymentIntentId,
    providerDecision: (updatedInvoice.metadata as InvoiceMetadata)?.providerDecision,
  } : null;

  // Fetch with line items for complete response
  const invoiceWithLineItems = await invoiceRepo.findOneWithLineItems(invoiceId);

  return ctx.json({
    id: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    customer: updatedInvoice.customer,
    merchant: updatedInvoice.merchant,
    context: updatedInvoice.context || null,
    status: updatedInvoice.status,
    subtotal: updatedInvoice.subtotal,
    tax: updatedInvoice.tax ?? null,
    total: updatedInvoice.total,
    currency: updatedInvoice.currency,
    paymentCaptureMethod: updatedInvoice.paymentCaptureMethod,
    paymentDueAt: updatedInvoice.paymentDueAt?.toISOString() ?? null,
    lineItems: ((invoiceWithLineItems as Record<string, unknown> | null)?.['lineItems'] as Array<Record<string, unknown>> || []).map((item: Record<string, unknown>) => ({
      description: item['description'],
      quantity: item['quantity'],
      unitPrice: item['unitPrice'],
      amount: item['amount'],
      metadata: item['metadata'] || null
    })),
    paymentStatus: updatedInvoice.paymentStatus ?? null,
    paidAt: updatedInvoice.paidAt?.toISOString() ?? null,
    paidBy: updatedInvoice.paidBy ?? null,
    voidedAt: updatedInvoice.voidedAt?.toISOString() ?? null,
    voidedBy: updatedInvoice.voidedBy ?? null,
    voidThresholdMinutes: updatedInvoice.voidThresholdMinutes ?? null,
    authorizedAt: updatedInvoice.authorizedAt?.toISOString() ?? null,
    authorizedBy: updatedInvoice.authorizedBy ?? null,
    metadata: safeMetadata,
    createdAt: updatedInvoice.createdAt.toISOString(),
    updatedAt: updatedInvoice.updatedAt.toISOString()
  }, 200);
}