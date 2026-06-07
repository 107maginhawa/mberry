/**
 * Stripe Webhook Endpoint
 *
 * Hand-wired route registered BEFORE auth middleware in app.ts.
 * Receives Stripe webhook events, verifies signature, and dispatches
 * to the webhook retry processor for idempotent processing.
 */

import type { Context } from 'hono';
import type { Variables } from '@/types/app';
import { handleIncomingWebhook, type WebhookEvent } from './jobs/webhookRetryProcessor';
import { createProcessPayment } from './jobs/processStripePayment';
import { auditAction } from '@/core/audit/audit-action';

/**
 * Map a Stripe event to our internal WebhookEvent shape.
 */
function stripeEventToWebhookEvent(event: {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}): WebhookEvent {
  const dataObject = event.data.object;
  const metadata = dataObject['metadata'] as Record<string, string> | undefined;

  return {
    idempotencyKey: event.id,
    provider: 'stripe',
    eventType: event.type,
    payload: dataObject,
    organizationId: metadata?.['orgId'] ?? metadata?.['organizationId'] ?? '',
  };
}

/**
 * Stripe webhook handler.
 *
 * - Reads raw body for signature verification
 * - Verifies via billing.verifyWebhookSignature
 * - Maps to WebhookEvent and dispatches to handleIncomingWebhook
 * - Returns 200 on success, 400 on invalid signature
 */
export async function stripeWebhookHandler(
  c: Context<{ Variables: Variables }>,
): Promise<Response> {
  const baseLogger = c.get('logger');
  const traceId = c.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'dues' }) ?? baseLogger;
  const billing = c.get('billing');
  const db = c.get('database');

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    logger.warn({ action: 'stripeWebhook.missingSignature' }, 'Missing stripe-signature header');
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  let rawBody: string;
  try {
    rawBody = await c.req.text();
  } catch {
    logger.error({ action: 'stripeWebhook.readBodyFailed' }, 'Failed to read webhook request body');
    return c.json({ error: 'Failed to read request body' }, 400);
  }

  let stripeEvent: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    stripeEvent = await billing.verifyWebhookSignature(rawBody, signature) as unknown as typeof stripeEvent;
  } catch (err) {
    logger.warn({ action: 'stripeWebhook.invalidSignature', error: err instanceof Error ? err.message : String(err) }, 'Invalid Stripe webhook signature');
    return c.json({ error: 'Invalid signature' }, 400);
  }

  logger.info({ action: 'stripeWebhook.received', eventId: stripeEvent.id, eventType: stripeEvent.type }, 'Received Stripe webhook');

  const webhookEvent = stripeEventToWebhookEvent(stripeEvent);
  const processPayment = createProcessPayment(billing, db, logger);

  const result = await handleIncomingWebhook({
    db,
    logger,
    event: webhookEvent,
    processPayment,
  });

  if (result.action === 'processed') {
    await auditAction(c, {
      action: 'create',
      resourceType: 'payment',
      resourceId: stripeEvent.id,
      description: `Stripe webhook processed: ${stripeEvent.type}`,
      eventSubType: 'financial.payment-recorded',
      details: { eventType: stripeEvent.type, organizationId: webhookEvent.organizationId },
    });
  }

  return c.json({ received: true, action: result.action }, result.status as 200);
}
