import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  ConflictError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { PayInvoiceBody, PayInvoiceParams } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import type { MerchantMetadata } from './repos/billing.schema';
import { PersonRepository } from '../person/repos/person.repo';
// Customer and merchant are both persons in monobase

/**
 * payInvoice
 * 
 * Path: POST /invoices/{id}/pay
 * OperationId: payInvoice
 * 
 * Create payment intent for invoice (Hold & Decide model)
 */
export async function payInvoice(
  ctx: ValidatedContext<PayInvoiceBody, never, PayInvoiceParams>
): Promise<Response> {
  const database = ctx.get('database');
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'billing' }) ?? baseLogger;
  const billing = ctx.get('billing');
  
  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  
  // Extract validated parameters and request body
  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const invoiceId = params.invoice;
  const { paymentMethod, metadata } = body;

  // Extract return URLs from metadata if provided
  const successUrl = metadata?.['successUrl'] as string | undefined;
  const cancelUrl = metadata?.['cancelUrl'] as string | undefined;

  // Validate payment method ID format (Stripe format: pm_*)
  if (paymentMethod && !paymentMethod.startsWith('pm_')) {
    throw new ValidationError('Invalid payment method ID format. Expected format: pm_*');
  }

  logger.info({ action: 'payInvoice.1', invoiceId, paymentMethod, hasReturnUrls: !!(successUrl && cancelUrl) }, 'Creating payment intent for invoice');
  
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

  // Authorization check: patient:owner means the authenticated user must be the patient
  const user = session.user;
  logger.info({ action: 'payInvoice.2', userId: user.id, invoiceCustomer: invoice.customer }, 'Authorization check starting');

  const customerPerson = await personRepo.findOneById(invoice.customer);
  if (!customerPerson) {
    throw new NotFoundError('Customer person not found', {
      resourceType: 'person',
      resource: invoice.customer,
      suggestions: ['Check customer person ID format', 'Verify customer person exists in system']
    });
  }

  logger.info({ action: 'payInvoice.3',
    customerId: invoice.customer,
    userId: user.id,
    match: invoice.customer === user.id
  }, 'Customer authorization check');

  if (invoice.customer !== user.id) {
    throw new ForbiddenError('You can only pay your own invoices');
  }

  // FIX-005 (BR-61): only `open` invoices are payable. Drafts have unfinalized
  // totals; void / uncollectible / paid are terminal. Charging any of these
  // would create a PaymentIntent against an invalid or already-settled invoice.
  if (invoice.status !== 'open') {
    throw new BusinessLogicError(
      `Invoice is not payable in its current status: ${invoice.status}`,
      'INVOICE_NOT_PAYABLE'
    );
  }

  // FIX-006: an in-progress or captured payment blocks re-pay; a failed or
  // canceled payment is retryable (m21 §1 "retry failed payments"). The old
  // check (`paymentStatus && !== 'pending'`) permanently 409'd a declined card.
  const blockingPaymentStatuses = ['requires_capture', 'processing', 'succeeded'];
  if (invoice.paymentStatus && blockingPaymentStatuses.includes(invoice.paymentStatus)) {
    throw new ConflictError('Payment already exists for this invoice');
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
  if (!merchantMetadata?.stripeAccountId || !merchantMetadata?.onboardingComplete) {
    throw new BusinessLogicError(
      'Provider has not completed billing setup',
      'PROVIDER_BILLING_INCOMPLETE'
    );
  }
  
  try {
    // Get pricing from invoice (already in cents as integers)
    const amount = invoice.total;
    const platformAmount = 0; // Deferred: platform fee calculation — billing v2. Tracked: GAP-BACKLOG.md
    const currency = invoice.currency;
    
    // Create payment intent with Stripe
    const paymentIntent = await billing.createPaymentIntent({
      amount: amount,
      currency: currency.toLowerCase(),
      connectedAccountId: merchantMetadata.stripeAccountId,
      platformFeeAmount: platformAmount,
      description: `Invoice ${invoice.invoiceNumber}`,
      successUrl: successUrl,
      cancelUrl: cancelUrl,
      metadata: {
        invoiceId,
        customerId: invoice.customer,
        merchantId: invoice.merchant,
        createdBy: user.id,
      },
    });
    
    // Update invoice with payment details
    // Store Stripe payment intent ID in metadata since it's not in the schema
    const updatedMetadata = {
      ...(invoice.metadata || {}),
      stripePaymentIntentId: paymentIntent.paymentIntentId,
    };
    await invoiceRepo.updateOneById(invoiceId, {
      paymentStatus: 'pending',
      metadata: updatedMetadata,
    });
    
    logger.info(
      { action: 'payInvoice.4',
        invoiceId,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: amount,
        currency,
        hasCheckoutUrl: !!paymentIntent.checkoutUrl
      },
      'Payment intent created successfully for invoice'
    );

    ctx.set('auditResourceId', paymentIntent.paymentIntentId);
    ctx.set('auditDescription', `Payment intent created for invoice ${invoiceId}: ${currency} ${amount}`);
    ctx.set('auditDetails', { invoiceId, amount, currency });

    // Return the response as defined in TypeSpec
    // Use Stripe Checkout URL if available (when success/cancel URLs provided)
    // Otherwise fall back to Payment Intent client secret
    const checkoutUrl = paymentIntent.checkoutUrl || 
      `https://checkout.stripe.com/pay/${paymentIntent.clientSecret}`;

    return ctx.json({
      checkoutUrl,
      metadata: {
        paymentIntentId: paymentIntent.paymentIntentId,
        clientSecret: paymentIntent.clientSecret,
        amount: amount,
        currency,
        status: paymentIntent.status,
      }
    }, 200);
    
  } catch (error) {
    logger.error({ action: 'payInvoice.5', error, invoiceId, paymentMethod }, 'Failed to create payment intent');
    
    if (error instanceof ValidationError || error instanceof ConflictError || error instanceof BusinessLogicError) {
      throw error;
    }
    
    throw new BusinessLogicError(
      'Failed to create payment intent. Please try again later.',
      'PAYMENT_INTENT_ERROR'
    );
  }
}