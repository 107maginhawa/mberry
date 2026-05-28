/**
 * processStripePayment — Stripe payment processing callback for webhook retry processor
 *
 * Creates a closure that matches the `(payload: Record<string, unknown>) => Promise<{ success: boolean }>`
 * signature expected by webhookRetryProcessor, while capturing billing + db + logger dependencies.
 */

import type { BillingService } from '@/core/billing';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from 'pino';
import { settlePayment } from '../../association:member/utils/settle-payment';

/**
 * Creates a processPayment callback bound to the given dependencies.
 *
 * The returned function handles two Stripe event types:
 * - `payment_intent.succeeded` — payment already captured, just settle in our DB
 * - `payment_intent.requires_capture` — capture via Stripe first, then settle
 *
 * Payload shape follows Stripe's `data.object` for PaymentIntent events.
 */
export function createProcessPayment(
  billing: BillingService,
  db: DatabaseInstance,
  logger: Logger,
): (payload: Record<string, unknown>) => Promise<{ success: boolean }> {
  return async (payload: Record<string, unknown>): Promise<{ success: boolean }> => {
    // The payload is the Stripe event's data.object (a PaymentIntent)
    const paymentIntentId = (payload['id'] as string) ?? (payload['payment_intent'] as string);
    if (!paymentIntentId) {
      throw new Error('Missing payment intent ID in webhook payload');
    }

    const metadata = payload['metadata'] as Record<string, string> | undefined;
    if (!metadata) {
      throw new Error('Missing metadata in webhook payload');
    }

    const orgId = metadata['orgId'] ?? metadata['organizationId'];
    const personId = metadata['personId'];
    const paymentId = metadata['paymentId'] ?? paymentIntentId;

    if (!orgId || !personId) {
      throw new Error(
        `Missing required metadata fields: orgId=${orgId}, personId=${personId}`,
      );
    }

    const amount = typeof payload['amount'] === 'number' ? payload['amount'] : 0;
    const status = payload['status'] as string | undefined;

    logger.info(
      { paymentIntentId, orgId, personId, status },
      'Processing Stripe payment webhook',
    );

    // If the payment requires capture (Hold & Decide model), capture first
    if (status === 'requires_capture') {
      const connectedAccountId = metadata['connectedAccountId'];
      if (!connectedAccountId) {
        throw new Error('Missing connectedAccountId in metadata for capture');
      }

      await billing.capturePaymentIntent(paymentIntentId, connectedAccountId);
      logger.info({ paymentIntentId }, 'Payment intent captured');
    }

    // Settle the payment in our database (fund allocation + membership extension)
    await settlePayment({
      db,
      orgId,
      personId,
      paymentId,
      amount,
    });

    logger.info(
      { paymentIntentId, orgId, personId, amount },
      'Payment settled successfully',
    );

    return { success: true };
  };
}
