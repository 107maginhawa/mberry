import type { BaseContext } from '@/types/app';
import type { NotificationService } from '@/core/notifs';
import {
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
// invoices are correlated via indexed repo lookups
// (invoiceRepo.findByStripePaymentIntentId / findByStripeTransferId — FIX-002).
import type { MerchantMetadata } from './repos/billing.schema';
import { subscriptions } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';

/**
 * handleStripeWebhook
 * 
 * Path: POST /billing/stripe-webhook
 * OperationId: handleStripeWebhook
 * 
 * Handle Stripe webhook events for invoice payments and merchant account updates
 */
export async function handleStripeWebhook(
  ctx: BaseContext
): Promise<Response> {
  const database = ctx.get('database');
  const baseLogger = ctx.get('logger');
  const billing = ctx.get('billing');
  const notificationService = ctx.get('notifs') as NotificationService;
  const traceId = ctx.get('requestId');

  // Child logger carries traceId + module on every call in this handler
  const logger = baseLogger?.child?.({ traceId, module: 'billing' }) ?? baseLogger;

  // Get the raw body and signature for webhook verification
  const signature = ctx.req.header('stripe-signature');
  if (!signature) {
    throw new ValidationError('Missing Stripe signature header');
  }

  const rawBody = await ctx.req.text();

  // NOTE: do NOT log the signature value (even truncated) — partial HMAC leaks to logs.
  logger?.info({ action: 'handleStripeWebhook.verify' }, 'Verifying Stripe webhook signature');

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = await billing.verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    logger?.error({ action: 'handleStripeWebhook.verifyFailed', error }, 'Webhook signature verification failed');
    throw new ValidationError('Invalid webhook signature');
  }

  logger?.info(
    {
      action: 'handleStripeWebhook.dispatch',
      eventType: event.type,
      eventId: event.id,
      livemode: event.livemode,
    },
    'Processing Stripe webhook event'
  );
  
  try {
    // Create repository instances
    const invoiceRepo = new InvoiceRepository(database, logger);
    const merchantAccountRepo = new MerchantAccountRepository(database, logger);
    
    // Handle different webhook event types
    switch (event.type as string) {
      // Payment Intent events
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event, invoiceRepo, logger, notificationService);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event, invoiceRepo, logger, notificationService);
        break;
        
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event, invoiceRepo, logger);
        break;
        
      case 'payment_intent.requires_action':
        await handlePaymentIntentRequiresAction(event, invoiceRepo, logger);
        break;
      
      // Charge events  
      case 'charge.succeeded':
        await handleChargeSucceeded(event, invoiceRepo, logger, notificationService);
        break;
        
      case 'charge.failed':
        await handleChargeFailed(event, invoiceRepo, logger, notificationService);
        break;
      
      // Refund events
      case 'charge.refunded':
        await handleChargeRefunded(event, invoiceRepo, logger);
        break;
      
      // Connect account events
      case 'account.updated':
        await handleAccountUpdated(event, merchantAccountRepo, logger);
        break;
        
      case 'account.application.deauthorized':
        await handleAccountDeauthorized(event, merchantAccountRepo, logger);
        break;
      
      // Transfer events (for platform fees)
      case 'transfer.created':
        await handleTransferCreated(event, invoiceRepo, logger);
        break;
        
      case 'transfer.failed': // structural: Stripe type gap — transfer.failed not in Stripe.Event['type'] union
        await handleTransferFailed(event, invoiceRepo, logger);
        break;

      // Subscription lifecycle events (UJ-M03)
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, database, logger);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, database, logger);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event, invoiceRepo, database, logger);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event, database, logger);
        break;

      default:
        logger.info(
          { action: 'handleStripeWebhook.4', eventType: event.type, eventId: event.id }, 
          'Unhandled webhook event type - ignoring'
        );
        break;
    }
    
    logger?.info(
      { action: 'handleStripeWebhook.completed', eventType: event.type, eventId: event.id },
      'Webhook event processed successfully'
    );

    ctx.set('auditResourceId', event.id);
    ctx.set('auditDescription', `Stripe webhook processed: ${event.type}`);
    ctx.set('auditDetails', {
        stripeEventType: event.type,
        stripeEventId: event.id,
        livemode: event.livemode,
      });

    // Return 200 to acknowledge receipt
    return ctx.json({ received: true }, 200);

  } catch (error) {
    logger?.error(
      { action: 'handleStripeWebhook.error', error, eventType: event.type, eventId: event.id },
      'Failed to process webhook event'
    );
    
    // Still return 200 to prevent retries for business logic errors
    if (error instanceof BusinessLogicError) {
      return ctx.json({ received: true, error: error.message }, 200);
    }
    
    throw new BusinessLogicError(
      'Failed to process webhook event',
      'WEBHOOK_PROCESSING_ERROR'
    );
  }
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(
  event: Stripe.Event, 
  invoiceRepo: InvoiceRepository,
  logger: any,
  notificationService: NotificationService
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const invoiceId = paymentIntent.metadata?.['invoiceId'];
  
  if (!invoiceId) {
    logger?.warn({ action: 'handlePaymentIntentSucceeded.noInvoiceId', paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) {
    logger?.warn({ action: 'handlePaymentIntentSucceeded.invoiceNotFound', invoiceId, paymentIntentId: paymentIntent.id }, 'Invoice not found for payment intent');
    return;
  }

  // FIX-004: idempotency — skip a redelivered event (same event.id already
  // processed for this invoice), mirroring the subscription dedupe pattern.
  if ((invoice.metadata as Record<string, unknown> | null)?.['lastStripeEventId'] === event.id) {
    logger?.debug({ action: 'handlePaymentIntentSucceeded.duplicate', stripeEventId: event.id, invoiceId: invoice.id }, 'Duplicate Stripe event — skipping');
    return;
  }

  // Update invoice status to requires_capture (authorized and ready for capture decision)
  // Store Stripe IDs in metadata
  const updatedMetadata = {
    ...(invoice.metadata || {}),
    stripePaymentIntentId: paymentIntent.id,
    lastStripeEventId: event.id,
  };

  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'requires_capture',
    metadata: updatedMetadata,
  });

  logger?.info(
    { action: 'handlePaymentIntentSucceeded.updated', invoiceId, paymentIntentId: paymentIntent.id },
    'Payment intent succeeded - invoice ready for provider decision'
  );

  // Send payment authorization notification to patient
  try {
    await notificationService.createNotification({
      organizationId: invoice.organizationId,
      recipient: invoice.customer,
      type: 'payment_authorized',
      title: 'Payment Authorized',
      message: 'Your payment has been authorized and is being held until the service is completed.',
      data: {
        invoiceId: invoice.id,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'authorized'
      },
      channels: ['in-app', 'email'],
      priority: 'normal'
    });

    logger?.info(
      { action: 'handlePaymentIntentSucceeded.notified', invoiceId, paymentIntentId: paymentIntent.id, customerId: invoice.customer },
      'Payment authorization notification sent'
    );
  } catch (error) {
    logger?.error(
      { action: 'handlePaymentIntentSucceeded.notifyFailed', error, invoiceId, paymentIntentId: paymentIntent.id },
      'Failed to send payment authorization notification'
    );
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any,
  notificationService: NotificationService
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const invoiceId = paymentIntent.metadata?.['invoiceId'];
  
  if (!invoiceId) {
    logger?.warn({ action: 'handlePaymentIntentFailed.noInvoiceId', paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) {
    logger?.warn({ action: 'handlePaymentIntentFailed.invoiceNotFound', invoiceId, paymentIntentId: paymentIntent.id }, 'Invoice not found for failed payment intent');
    return;
  }

  // FIX-004: idempotency — skip a redelivered event for this invoice.
  if ((invoice.metadata as Record<string, unknown> | null)?.['lastStripeEventId'] === event.id) {
    logger?.debug({ action: 'handlePaymentIntentFailed.duplicate', stripeEventId: event.id, invoiceId: invoice.id }, 'Duplicate Stripe event — skipping');
    return;
  }

  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'failed',
    metadata: {
      ...(invoice.metadata || {}),
      lastStripeEventId: event.id,
    },
  });

  logger?.info(
    { action: 'handlePaymentIntentFailed.updated', invoiceId, paymentIntentId: paymentIntent.id },
    'Payment intent failed'
  );

  // Send payment failure notification to patient
  try {
    await notificationService.createNotification({
      organizationId: invoice.organizationId,
      recipient: invoice.customer,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please update your payment method and try again.',
      data: {
        invoiceId: invoice.id,
        paymentIntentId: paymentIntent.id,
        failureReason: paymentIntent.last_payment_error?.message || 'Payment processing failed',
        status: 'failed',
        failedAt: new Date().toISOString()
      },
      channels: ['in-app', 'email', 'sms'],
      priority: 'high'
    });

    logger?.info(
      { action: 'handlePaymentIntentFailed.notified', invoiceId, paymentIntentId: paymentIntent.id, customerId: invoice.customer },
      'Payment failure notification sent'
    );
  } catch (error) {
    logger?.error(
      { action: 'handlePaymentIntentFailed.notifyFailed', error, invoiceId, paymentIntentId: paymentIntent.id },
      'Failed to send payment failure notification'
    );
  }
}

/**
 * Handle payment_intent.canceled event
 */
async function handlePaymentIntentCanceled(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const invoiceId = paymentIntent.metadata?.['invoiceId'];
  
  if (!invoiceId) {
    logger?.warn({ action: 'handlePaymentIntentCanceled.noInvoiceId', paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }

  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'canceled',
    status: 'void',
    voidedAt: new Date(),
  });

  logger?.info(
    { action: 'handlePaymentIntentCanceled.updated', invoiceId, paymentIntentId: paymentIntent.id },
    'Payment intent canceled'
  );
}

/**
 * Handle payment_intent.requires_action event
 */
async function handlePaymentIntentRequiresAction(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const invoiceId = paymentIntent.metadata?.['invoiceId'];
  
  if (!invoiceId) {
    logger?.warn({ action: 'handlePaymentIntentRequiresAction.noInvoiceId', paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }

  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'processing',
  });

  logger?.info(
    { action: 'handlePaymentIntentRequiresAction.updated', invoiceId, paymentIntentId: paymentIntent.id },
    'Payment intent requires additional action'
  );
}

/**
 * Handle charge.succeeded event
 */
async function handleChargeSucceeded(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any,
  notificationService: NotificationService
) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;
  
  if (!paymentIntentId) {
    logger?.warn({ action: 'handleChargeSucceeded.noPaymentIntentId', chargeId: charge.id }, 'No payment intent ID in charge');
    return;
  }

  // Find invoice by payment intent ID via indexed JSONB lookup (FIX-002).
  const invoice = await invoiceRepo.findByStripePaymentIntentId(paymentIntentId);

  if (!invoice) {
    logger?.warn({ action: 'handleChargeSucceeded.invoiceNotFound', paymentIntentId, chargeId: charge.id }, 'No invoice found for charge');
    return;
  }

  // FIX-004: idempotency — skip a redelivered event for this invoice (prevents
  // double customer+merchant notifications on Stripe charge.succeeded retries).
  if ((invoice.metadata as Record<string, unknown> | null)?.['lastStripeEventId'] === event.id) {
    logger?.debug({ action: 'handleChargeSucceeded.duplicate', stripeEventId: event.id, invoiceId: invoice.id }, 'Duplicate Stripe event — skipping');
    return;
  }

  const transferId = charge.transfer as string;

  // Update invoice with charge details in metadata
  const updatedMetadata = {
    ...(invoice.metadata || {}),
    stripeChargeId: charge.id,
    stripeTransferId: transferId,
    lastStripeEventId: event.id,
  };

  await invoiceRepo.updateOneById(invoice.id, {
    paymentStatus: 'succeeded',
    status: 'paid',
    paidAt: new Date(),
    metadata: updatedMetadata,
  });

  logger?.info(
    {
      action: 'handleChargeSucceeded.updated',
      invoiceId: invoice.id,
      chargeId: charge.id,
      transferId,
    },
    'Charge succeeded - payment captured'
  );

  // Send payment success notifications to both patient and provider
  try {
    // Notification for patient - payment captured
    await notificationService.createNotification({
      organizationId: invoice.organizationId,
      recipient: invoice.customer,
      type: 'payment_captured',
      title: 'Payment Processed',
      message: 'Your payment has been successfully processed and captured.',
      data: {
        invoiceId: invoice.id,
        chargeId: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: 'captured',
        capturedAt: new Date().toISOString()
      },
      channels: ['in-app', 'email'],
      priority: 'normal'
    });

    // Notification for provider - payment received
    await notificationService.createNotification({
      organizationId: invoice.organizationId,
      recipient: invoice.merchant,
      type: 'payment_received',
      title: 'Payment Received',
      message: 'Payment for your invoice has been processed and will be transferred to your account.',
      data: {
        invoiceId: invoice.id,
        chargeId: charge.id,
        transferId: transferId,
        amount: charge.amount,
        currency: charge.currency,
        customerId: invoice.customer
      },
      channels: ['in-app', 'email'],
      priority: 'normal'
    });

    logger?.info(
      { action: 'handleChargeSucceeded.notified', invoiceId: invoice.id, chargeId: charge.id, customerId: invoice.customer, merchantId: invoice.merchant },
      'Payment success notifications sent'
    );
  } catch (error) {
    logger?.error(
      { action: 'handleChargeSucceeded.notifyFailed', error, invoiceId: invoice.id, chargeId: charge.id },
      'Failed to send payment success notifications'
    );
  }
}

/**
 * Handle charge.failed event
 */
async function handleChargeFailed(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any,
  notificationService: NotificationService
) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;
  
  if (!paymentIntentId) {
    logger?.warn({ action: 'handleChargeFailed.noPaymentIntentId', chargeId: charge.id }, 'No payment intent ID in failed charge');
    return;
  }

  // Find invoice by payment intent ID via indexed JSONB lookup (FIX-002).
  const invoice = await invoiceRepo.findByStripePaymentIntentId(paymentIntentId);

  if (!invoice) {
    logger?.warn({ action: 'handleChargeFailed.invoiceNotFound', paymentIntentId, chargeId: charge.id }, 'No invoice found for failed charge');
    return;
  }

  // FIX-004: idempotency — skip a redelivered event for this invoice.
  if ((invoice.metadata as Record<string, unknown> | null)?.['lastStripeEventId'] === event.id) {
    logger?.debug({ action: 'handleChargeFailed.duplicate', stripeEventId: event.id, invoiceId: invoice.id }, 'Duplicate Stripe event — skipping');
    return;
  }

  await invoiceRepo.updateOneById(invoice.id, {
    paymentStatus: 'failed',
    metadata: {
      ...(invoice.metadata || {}),
      lastStripeEventId: event.id,
    },
  });

  logger?.info(
    { action: 'handleChargeFailed.updated', invoiceId: invoice.id, chargeId: charge.id },
    'Charge failed'
  );

  // Send charge failure notification to patient
  try {
    await notificationService.createNotification({
      organizationId: invoice.organizationId,
      recipient: invoice.customer,
      type: 'charge_failed',
      title: 'Payment Charge Failed',
      message: 'There was an issue processing your payment charge. Please contact support if this continues.',
      data: {
        invoiceId: invoice.id,
        chargeId: charge.id,
        paymentIntentId: paymentIntentId,
        failureCode: charge.failure_code,
        failureMessage: charge.failure_message,
        status: 'failed',
        failedAt: new Date().toISOString()
      },
      channels: ['in-app', 'email'],
      priority: 'high'
    });

    logger?.info(
      { action: 'handleChargeFailed.notified', invoiceId: invoice.id, chargeId: charge.id, customerId: invoice.customer },
      'Charge failure notification sent'
    );
  } catch (error) {
    logger?.error(
      { action: 'handleChargeFailed.notifyFailed', error, invoiceId: invoice.id, chargeId: charge.id },
      'Failed to send charge failure notification'
    );
  }
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any
) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;
  
  if (!paymentIntentId) {
    logger?.warn({ action: 'handleChargeRefunded.noPaymentIntentId', chargeId: charge.id }, 'No payment intent ID in refunded charge');
    return;
  }

  // Find invoice by payment intent ID via indexed JSONB lookup (FIX-002).
  const invoice = await invoiceRepo.findByStripePaymentIntentId(paymentIntentId);

  if (!invoice) {
    logger?.warn({ action: 'handleChargeRefunded.invoiceNotFound', paymentIntentId, chargeId: charge.id }, 'No invoice found for refunded charge');
    return;
  }

  // FIX-004: idempotency — skip a redelivered refund event for this invoice.
  if ((invoice.metadata as Record<string, unknown> | null)?.['lastStripeEventId'] === event.id) {
    logger?.debug({ action: 'handleChargeRefunded.duplicate', stripeEventId: event.id, invoiceId: invoice.id }, 'Duplicate Stripe event — skipping');
    return;
  }

  const refund = charge.refunds?.data[0]; // Get the latest refund

  if (refund) {
    const isFullRefund = charge.amount_refunded === charge.amount;
    const refundAmountDecimal = (charge.amount_refunded / 100).toFixed(2);

    // Store refund details in metadata
    const updatedMetadata = {
      ...(invoice.metadata || {}),
      stripeRefundId: refund.id,
      refundAmount: refundAmountDecimal,
      refundReason: refund.reason || 'requested_by_customer',
      refundedAt: new Date().toISOString(),
      refundStatus: isFullRefund ? 'full_refund' : 'partial_refund',
      lastStripeEventId: event.id,
    };

    await invoiceRepo.updateOneById(invoice.id, {
      // Keep paymentStatus as 'succeeded' since enum doesn't have refunded status
      // Refund tracking is in metadata
      metadata: updatedMetadata,
    });

    logger?.info(
      {
        action: 'handleChargeRefunded.updated',
        invoiceId: invoice.id,
        chargeId: charge.id,
        refundId: refund.id,
        refundAmount: charge.amount_refunded,
        isFullRefund,
      },
      'Charge refunded'
    );
  }
}

/**
 * Handle account.updated event (Connect account changes)
 */
async function handleAccountUpdated(
  event: Stripe.Event,
  merchantAccountRepo: MerchantAccountRepository,
  logger: any
) {
  const account = event.data.object as Stripe.Account;
  
  // Find merchant account by Stripe account ID
  const merchantAccount = await merchantAccountRepo.findByStripeAccountId(account.id);
  
  if (!merchantAccount) {
    logger?.warn({ action: 'handleAccountUpdated.notFound', accountId: account.id }, 'No merchant account found for Stripe account update');
    return;
  }

  // Determine account status
  let status: string = 'pending';
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'active';
  } else if (account.requirements?.disabled_reason) {
    status = 'restricted';
  }

  const onboardingComplete = !account.requirements?.currently_due?.length;

  // Update metadata JSONB field
  const metadata = merchantAccount.metadata as MerchantMetadata;
  await merchantAccountRepo.updateOneById(merchantAccount.id, {
    metadata: {
      ...metadata,
      stripeAccountStatus: status,
      onboardingComplete: onboardingComplete,
      lastWebhookUpdate: new Date().toISOString(),
      accountChargesEnabled: account.charges_enabled,
      accountPayoutsEnabled: account.payouts_enabled,
      requirementsCurrentlyDue: account.requirements?.currently_due || []
    }
  });

  logger?.info(
    {
      action: 'handleAccountUpdated.updated',
      merchantAccountId: merchantAccount.id,
      accountId: account.id,
      status,
      onboardingComplete,
      requirementsCount: account.requirements?.currently_due?.length || 0,
    },
    'Merchant account updated via webhook'
  );
}

/**
 * Handle account.application.deauthorized event
 */
async function handleAccountDeauthorized(
  event: Stripe.Event,
  merchantAccountRepo: MerchantAccountRepository,
  logger: any
) {
  const deauth = event.data.object as { account: string };

  // Find merchant account by Stripe account ID
  const merchantAccount = await merchantAccountRepo.findByStripeAccountId(deauth.account);

  if (!merchantAccount) {
    logger?.warn({ action: 'handleAccountDeauthorized.notFound', accountId: deauth.account }, 'No merchant account found for deauthorized Stripe account');
    return;
  }

  // Update metadata JSONB field with deauthorization status
  const metadata = merchantAccount.metadata as MerchantMetadata;
  await merchantAccountRepo.updateOneById(merchantAccount.id, {
    active: false,
    metadata: {
      ...metadata,
      stripeAccountStatus: 'restricted',
      onboardingComplete: false,
      deauthorizedAt: new Date().toISOString(),
      lastWebhookUpdate: new Date().toISOString()
    }
  });

  logger?.info(
    { action: 'handleAccountDeauthorized.updated', merchantAccountId: merchantAccount.id, accountId: deauth.account },
    'Merchant account Stripe account deauthorized'
  );
}

/**
 * Handle transfer.created event
 */
async function handleTransferCreated(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any
) {
  const transfer = event.data.object as Stripe.Transfer;
  
  // Find invoices by transfer ID via indexed JSONB lookup (FIX-002).
  const foundInvoices = await invoiceRepo.findByStripeTransferId(transfer.id);

  if (!foundInvoices || foundInvoices.length === 0) {
    logger?.info({ action: 'handleTransferCreated.noInvoice', transferId: transfer.id }, 'Transfer created but no associated invoice found');
    return;
  }

  logger?.info(
    {
      action: 'handleTransferCreated.matched',
      transferId: transfer.id,
      amount: transfer.amount,
      invoiceIds: foundInvoices.map((i: any) => i.id),
    },
    'Transfer created for invoice payments'
  );
}

/**
 * Handle transfer.failed event
 */
async function handleTransferFailed(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  logger: any
) {
  const transfer = event.data.object as Stripe.Transfer;
  
  // Find invoices by transfer ID via indexed JSONB lookup (FIX-002).
  const foundInvoices = await invoiceRepo.findByStripeTransferId(transfer.id);

  if (!foundInvoices || foundInvoices.length === 0) {
    logger?.warn({ action: 'handleTransferFailed.noInvoice', transferId: transfer.id }, 'Transfer failed but no associated invoice found');
    return;
  }

  // Mark invoice as having transfer issues (might need manual review)
  for (const invoice of foundInvoices) {
    logger?.error(
      {
        action: 'handleTransferFailed.error',
        invoiceId: invoice.id,
        transferId: transfer.id,
        failureMessage: (transfer as any).failure_message, // structural: Stripe type gap — failure_message not in Stripe.Transfer type
      },
      'Transfer failed for invoice - requires manual review'
    );
  }
}

// ── Subscription lifecycle handlers (UJ-M03) ─────────────────────────────────

/**
 * Handle customer.subscription.updated — sync status from Stripe to local subscription.
 */
async function handleSubscriptionUpdated(
  event: Stripe.Event,
  database: any,
  logger: any,
) {
  const stripeSub = event.data.object as Stripe.Subscription;
  const stripeEventId = event.id;

  // Find local subscription by stripeSubscriptionId
  const [local] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id))
    .limit(1);

  if (!local) {
    logger?.warn({ action: 'handleSubscriptionUpdated.notFound', stripeSubscriptionId: stripeSub.id }, 'No local subscription found for Stripe subscription update');
    return;
  }

  // Idempotency guard
  if (local.lastStripeEventId === stripeEventId) {
    logger?.debug({ action: 'handleSubscriptionUpdated.duplicate', stripeEventId, subscriptionId: local.id }, 'Duplicate Stripe event — skipping');
    return;
  }

  // Map Stripe status to local status
  const stripeStatusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'past_due',
    trialing: 'trial',
    paused: 'past_due',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
  };

  const newStatus = stripeStatusMap[stripeSub.status] ?? 'past_due';
  const now = new Date();

  const stripeSubAny = stripeSub as any; // structural: Stripe 2025 API type gap — current_period_start/end moved
  await database
    .update(subscriptions)
    .set({
      status: newStatus,
      currentPeriodStart: stripeSubAny.current_period_start
        ? new Date(stripeSubAny.current_period_start * 1000)
        : local.currentPeriodStart,
      currentPeriodEnd: stripeSubAny.current_period_end
        ? new Date(stripeSubAny.current_period_end * 1000)
        : local.currentPeriodEnd,
      lastStripeEventId: stripeEventId,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, local.id));

  logger?.info(
    { action: 'handleSubscriptionUpdated.synced', subscriptionId: local.id, stripeStatus: stripeSub.status, localStatus: newStatus },
    'Subscription synced from Stripe update',
  );
}

/**
 * Handle customer.subscription.deleted — mark local subscription as cancelled.
 */
async function handleSubscriptionDeleted(
  event: Stripe.Event,
  database: any,
  logger: any,
) {
  const stripeSub = event.data.object as Stripe.Subscription;
  const stripeEventId = event.id;

  const [local] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id))
    .limit(1);

  if (!local) {
    logger?.warn({ action: 'handleSubscriptionDeleted.notFound', stripeSubscriptionId: stripeSub.id }, 'No local subscription found for Stripe subscription deletion');
    return;
  }

  if (local.lastStripeEventId === stripeEventId) {
    logger?.debug({ action: 'handleSubscriptionDeleted.duplicate', stripeEventId }, 'Duplicate Stripe event — skipping');
    return;
  }

  const now = new Date();
  await database
    .update(subscriptions)
    .set({
      status: 'cancelled',
      cancelledAt: now,
      cancelReason: 'Cancelled via Stripe (subscription deleted)',
      lastStripeEventId: stripeEventId,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, local.id));

  logger?.info({ action: 'handleSubscriptionDeleted.cancelled', subscriptionId: local.id }, 'Subscription cancelled via Stripe deletion event');
}

/**
 * Handle invoice.payment_succeeded — extend currentPeriodEnd and set status=active.
 * Also handles dues invoices (existing behaviour preserved via fallback).
 */
async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  database: any,
  logger: any,
) {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeEventId = event.id;

  // Try to match a platform subscription via subscription ID
  // structural: Stripe 2025 API — `subscription` was removed from the static
  // Invoice type in Stripe SDK v19 but is still present at runtime when the
  // invoice originated from a subscription (verified via Stripe payload schema).
  const stripeSubscriptionId = (invoice as { subscription?: string | null }).subscription ?? null;
  if (stripeSubscriptionId) {
    const [local] = await database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);

    if (local) {
      if (local.lastStripeEventId === stripeEventId) {
        logger?.debug({ action: 'handleInvoicePaymentSucceeded.duplicate', stripeEventId }, 'Duplicate invoice.payment_succeeded — skipping');
        return;
      }

      // structural: Stripe 2025 API — `lines.data` typing intermittent; runtime always present.
      const lines = (invoice as { lines?: { data?: Array<{ period?: { end?: number } }> } }).lines?.data ?? [];
      const periodEnd = lines[0]?.period?.end
        ? new Date(lines[0].period.end * 1000)
        : null;

      const now = new Date();
      await database
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : local.currentPeriodStart,
          currentPeriodEnd: periodEnd ?? local.currentPeriodEnd,
          lastStripeEventId: stripeEventId,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, local.id));

      logger?.info({ action: 'handleInvoicePaymentSucceeded.activated', subscriptionId: local.id }, 'Subscription activated on payment success');
      return;
    }
  }

  // Fallback: not a platform subscription invoice — ignore (dues handled elsewhere)
  logger?.debug({ action: 'handleInvoicePaymentSucceeded.noSubscription', invoiceId: invoice.id }, 'invoice.payment_succeeded — no matching platform subscription');
}

/**
 * Handle invoice.payment_failed — set subscription to past_due.
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  database: any,
  logger: any,
) {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeEventId = event.id;

  // structural: Stripe 2025 API — `subscription` removed from static Invoice type, present at runtime.
  const stripeSubscriptionId = (invoice as { subscription?: string | null }).subscription ?? null;
  if (!stripeSubscriptionId) {
    logger?.debug({ action: 'handleInvoicePaymentFailed.noSubscriptionId', invoiceId: invoice.id }, 'invoice.payment_failed — no subscription ID, skipping');
    return;
  }

  const [local] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!local) {
    logger?.debug({ action: 'handleInvoicePaymentFailed.noSubscription', stripeSubscriptionId }, 'invoice.payment_failed — no matching platform subscription');
    return;
  }

  if (local.lastStripeEventId === stripeEventId) {
    logger?.debug({ action: 'handleInvoicePaymentFailed.duplicate', stripeEventId }, 'Duplicate invoice.payment_failed — skipping');
    return;
  }

  const now = new Date();
  await database
    .update(subscriptions)
    .set({
      status: 'past_due',
      lastStripeEventId: stripeEventId,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, local.id));

  logger?.info({ action: 'handleInvoicePaymentFailed.pastDue', subscriptionId: local.id }, 'Subscription set to past_due on invoice payment failure');
}