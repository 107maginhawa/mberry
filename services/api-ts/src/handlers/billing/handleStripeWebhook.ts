import type { BaseContext } from '@/types/app';
import type { NotificationService } from '@/core/notifs';
import {
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
// invoices table import removed — use invoiceRepo.findAll() instead
import type { InvoiceMetadata, MerchantMetadata } from './repos/billing.schema';
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
  const logger = ctx.get('logger');
  const billing = ctx.get('billing');
  const notificationService = ctx.get('notifs') as NotificationService;
  
  // Get the raw body and signature for webhook verification
  const signature = ctx.req.header('stripe-signature');
  if (!signature) {
    throw new ValidationError('Missing Stripe signature header');
  }
  
  const rawBody = await ctx.req.text();
  
  logger.info({ signature: signature.substring(0, 20) }, 'Processing Stripe webhook');
  
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = await billing.verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    logger.error({ error }, 'Webhook signature verification failed');
    throw new ValidationError('Invalid webhook signature');
  }
  
  logger.info(
    { 
      eventType: event.type,
      eventId: event.id,
      livemode: event.livemode 
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
          { eventType: event.type, eventId: event.id }, 
          'Unhandled webhook event type - ignoring'
        );
        break;
    }
    
    logger.info(
      { eventType: event.type, eventId: event.id }, 
      'Webhook event processed successfully'
    );
    
    // Return 200 to acknowledge receipt
    return ctx.json({ received: true }, 200);
    
  } catch (error) {
    logger.error(
      { error, eventType: event.type, eventId: event.id }, 
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
    logger.warn({ paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }
  
  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) {
    logger.warn({ invoiceId, paymentIntentId: paymentIntent.id }, 'Invoice not found for payment intent');
    return;
  }
  
  // Update invoice status to requires_capture (authorized and ready for capture decision)
  // Store Stripe IDs in metadata
  const updatedMetadata = {
    ...(invoice.metadata || {}),
    stripePaymentIntentId: paymentIntent.id,
  };

  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'requires_capture',
    metadata: updatedMetadata,
  });
  
  logger.info(
    { invoiceId, paymentIntentId: paymentIntent.id }, 
    'Payment intent succeeded - invoice ready for provider decision'
  );

  // Send payment authorization notification to patient
  try {
    await notificationService.createNotification({
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

    logger.info(
      { invoiceId, paymentIntentId: paymentIntent.id, customerId: invoice.customer },
      'Payment authorization notification sent'
    );
  } catch (error) {
    logger.error(
      { error, invoiceId, paymentIntentId: paymentIntent.id },
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
    logger.warn({ paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) {
    logger.warn({ invoiceId, paymentIntentId: paymentIntent.id }, 'Invoice not found for failed payment intent');
    return;
  }
  
  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'failed',
  });
  
  logger.info(
    { invoiceId, paymentIntentId: paymentIntent.id }, 
    'Payment intent failed'
  );

  // Send payment failure notification to patient
  try {
    await notificationService.createNotification({
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

    logger.info(
      { invoiceId, paymentIntentId: paymentIntent.id, customerId: invoice.customer },
      'Payment failure notification sent'
    );
  } catch (error) {
    logger.error(
      { error, invoiceId, paymentIntentId: paymentIntent.id },
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
    logger.warn({ paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }
  
  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'canceled',
    status: 'void',
    voidedAt: new Date(),
  });
  
  logger.info(
    { invoiceId, paymentIntentId: paymentIntent.id }, 
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
    logger.warn({ paymentIntentId: paymentIntent.id }, 'No invoice ID in payment intent metadata');
    return;
  }
  
  await invoiceRepo.updateOneById(invoiceId, {
    paymentStatus: 'processing',
  });
  
  logger.info(
    { invoiceId, paymentIntentId: paymentIntent.id }, 
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
    logger.warn({ chargeId: charge.id }, 'No payment intent ID in charge');
    return;
  }
  
  // Find invoice by payment intent ID in metadata
  // Note: This requires a custom query since we're searching in JSONB
  const allInvoices = await invoiceRepo.findAll();

  const invoice = allInvoices.find((inv: any) => {
    const metadata = inv.metadata as InvoiceMetadata;
    return metadata?.stripePaymentIntentId === paymentIntentId;
  });

  if (!invoice) {
    logger.warn({ paymentIntentId, chargeId: charge.id }, 'No invoice found for charge');
    return;
  }

  const transferId = charge.transfer as string;

  // Update invoice with charge details in metadata
  const updatedMetadata = {
    ...(invoice.metadata || {}),
    stripeChargeId: charge.id,
    stripeTransferId: transferId,
  };

  await invoiceRepo.updateOneById(invoice.id, {
    paymentStatus: 'succeeded',
    status: 'paid',
    paidAt: new Date(),
    metadata: updatedMetadata,
  });
  
  logger.info(
    { 
      invoiceId: invoice.id, 
      chargeId: charge.id,
      transferId 
    }, 
    'Charge succeeded - payment captured'
  );

  // Send payment success notifications to both patient and provider
  try {
    // Notification for patient - payment captured
    await notificationService.createNotification({
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

    logger.info(
      { invoiceId: invoice.id, chargeId: charge.id, customerId: invoice.customer, merchantId: invoice.merchant },
      'Payment success notifications sent'
    );
  } catch (error) {
    logger.error(
      { error, invoiceId: invoice.id, chargeId: charge.id },
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
    logger.warn({ chargeId: charge.id }, 'No payment intent ID in failed charge');
    return;
  }
  
  // Find invoice by payment intent ID in metadata
  const allInvoices = await invoiceRepo.findAll();

  const invoice = allInvoices.find((inv: any) => {
    const metadata = inv.metadata as InvoiceMetadata;
    return metadata?.stripePaymentIntentId === paymentIntentId;
  });

  if (!invoice) {
    logger.warn({ paymentIntentId, chargeId: charge.id }, 'No invoice found for failed charge');
    return;
  }
  
  await invoiceRepo.updateOneById(invoice.id, {
    paymentStatus: 'failed',
  });
  
  logger.info(
    { invoiceId: invoice.id, chargeId: charge.id }, 
    'Charge failed'
  );

  // Send charge failure notification to patient
  try {
    await notificationService.createNotification({
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

    logger.info(
      { invoiceId: invoice.id, chargeId: charge.id, customerId: invoice.customer },
      'Charge failure notification sent'
    );
  } catch (error) {
    logger.error(
      { error, invoiceId: invoice.id, chargeId: charge.id },
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
    logger.warn({ chargeId: charge.id }, 'No payment intent ID in refunded charge');
    return;
  }
  
  // Find invoice by payment intent ID in metadata
  const allInvoices = await invoiceRepo.findAll();

  const invoice = allInvoices.find((inv: any) => {
    const metadata = inv.metadata as InvoiceMetadata;
    return metadata?.stripePaymentIntentId === paymentIntentId;
  });

  if (!invoice) {
    logger.warn({ paymentIntentId, chargeId: charge.id }, 'No invoice found for refunded charge');
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
    };

    await invoiceRepo.updateOneById(invoice.id, {
      // Keep paymentStatus as 'succeeded' since enum doesn't have refunded status
      // Refund tracking is in metadata
      metadata: updatedMetadata,
    });

    logger.info(
      {
        invoiceId: invoice.id,
        chargeId: charge.id,
        refundId: refund.id,
        refundAmount: charge.amount_refunded,
        isFullRefund
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
    logger.warn({ accountId: account.id }, 'No merchant account found for Stripe account update');
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

  logger.info(
    {
      merchantAccountId: merchantAccount.id,
      accountId: account.id,
      status,
      onboardingComplete,
      requirementsCount: account.requirements?.currently_due?.length || 0
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
    logger.warn({ accountId: deauth.account }, 'No merchant account found for deauthorized Stripe account');
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

  logger.info(
    { merchantAccountId: merchantAccount.id, accountId: deauth.account },
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
  
  // Find invoice by transfer ID in metadata
  const allInvoices = await invoiceRepo.findAll();

  const foundInvoices = allInvoices.filter((inv: any) => {
    const metadata = inv.metadata as InvoiceMetadata;
    return metadata?.stripeTransferId === transfer.id;
  });

  if (!foundInvoices || foundInvoices.length === 0) {
    logger.info({ transferId: transfer.id }, 'Transfer created but no associated invoice found');
    return;
  }
  
  logger.info(
    { 
      transferId: transfer.id,
      amount: transfer.amount,
      invoiceIds: foundInvoices.map((i: any) => i.id)
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
  
  // Find invoice by transfer ID in metadata
  const allInvoices = await invoiceRepo.findAll();

  const foundInvoices = allInvoices.filter((inv: any) => {
    const metadata = inv.metadata as InvoiceMetadata;
    return metadata?.stripeTransferId === transfer.id;
  });

  if (!foundInvoices || foundInvoices.length === 0) {
    logger.warn({ transferId: transfer.id }, 'Transfer failed but no associated invoice found');
    return;
  }
  
  // Mark invoice as having transfer issues (might need manual review)
  for (const invoice of foundInvoices) {
    logger.error(
      {
        invoiceId: invoice.id,
        transferId: transfer.id,
        failureMessage: (transfer as any).failure_message // structural: Stripe type gap — failure_message not in Stripe.Transfer type
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
    logger.warn({ stripeSubscriptionId: stripeSub.id }, 'No local subscription found for Stripe subscription update');
    return;
  }

  // Idempotency guard
  if (local.lastStripeEventId === stripeEventId) {
    logger.debug({ stripeEventId, subscriptionId: local.id }, 'Duplicate Stripe event — skipping');
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

  logger.info(
    { subscriptionId: local.id, stripeStatus: stripeSub.status, localStatus: newStatus },
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
    logger.warn({ stripeSubscriptionId: stripeSub.id }, 'No local subscription found for Stripe subscription deletion');
    return;
  }

  if (local.lastStripeEventId === stripeEventId) {
    logger.debug({ stripeEventId }, 'Duplicate Stripe event — skipping');
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

  logger.info({ subscriptionId: local.id }, 'Subscription cancelled via Stripe deletion event');
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
  const stripeSubscriptionId = (invoice as any).subscription as string | null;
  if (stripeSubscriptionId) {
    const [local] = await database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);

    if (local) {
      if (local.lastStripeEventId === stripeEventId) {
        logger.debug({ stripeEventId }, 'Duplicate invoice.payment_succeeded — skipping');
        return;
      }

      const lines = (invoice as any).lines?.data ?? [];
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

      logger.info({ subscriptionId: local.id }, 'Subscription activated on payment success');
      return;
    }
  }

  // Fallback: not a platform subscription invoice — ignore (dues handled elsewhere)
  logger.debug({ invoiceId: invoice.id }, 'invoice.payment_succeeded — no matching platform subscription');
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

  const stripeSubscriptionId = (invoice as any).subscription as string | null;
  if (!stripeSubscriptionId) {
    logger.debug({ invoiceId: invoice.id }, 'invoice.payment_failed — no subscription ID, skipping');
    return;
  }

  const [local] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!local) {
    logger.debug({ stripeSubscriptionId }, 'invoice.payment_failed — no matching platform subscription');
    return;
  }

  if (local.lastStripeEventId === stripeEventId) {
    logger.debug({ stripeEventId }, 'Duplicate invoice.payment_failed — skipping');
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

  logger.info({ subscriptionId: local.id }, 'Subscription set to past_due on invoice payment failure');
}