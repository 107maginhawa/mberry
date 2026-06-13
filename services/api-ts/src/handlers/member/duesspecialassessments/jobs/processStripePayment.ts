/**
 * processStripePayment — Stripe payment processing callback for webhook retry processor
 *
 * Creates a closure that matches the `(payload: Record<string, unknown>) => Promise<{ success: boolean }>`
 * signature expected by webhookRetryProcessor, while capturing billing + db + logger dependencies.
 */

import type { BillingService } from '@/core/billing';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from 'pino';
import { settlePayment as defaultSettlePayment } from '@/handlers/association:member/utils/settle-payment';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';

/**
 * Creates a processPayment callback bound to the given dependencies.
 *
 * The returned function handles two Stripe event types:
 * - `payment_intent.succeeded` — payment already captured, just settle in our DB
 * - `payment_intent.requires_capture` — capture via Stripe first, then settle
 *
 * Payload shape follows Stripe's `data.object` for PaymentIntent events.
 *
 * @param settle - Injectable for testing. Defaults to real settlePayment.
 */
export function createProcessPayment(
  billing: BillingService,
  db: DatabaseInstance,
  logger: Logger,
  settle: typeof defaultSettlePayment = defaultSettlePayment,
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
    // [FIX-001] paymentId MUST be the real DuesPayment row id (a UUID) written
    // by checkoutPaymentToken. The previous fallback to the Stripe `pi_...`
    // intent id produced a non-UUID that failed the fund-allocation FK insert
    // and dead-lettered the webhook — leaving money charged with no ledger row.
    const paymentId = metadata['paymentId'];

    if (!orgId || !personId) {
      throw new Error(
        `Missing required metadata fields: orgId=${orgId}, personId=${personId}`,
      );
    }
    if (!paymentId) {
      throw new Error(
        'Missing metadata.paymentId — cannot settle online payment without the ledger row id',
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

    // [FIX-001] Load the pending ledger row so we can settle it, flip its
    // status, and mark its invoice paid — a COMPLETE financial record.
    const duesRepo = new DuesRepository(db);
    const payment = await duesRepo.getPayment(paymentId);
    if (!payment) {
      throw new Error(`No DuesPayment row found for metadata.paymentId=${paymentId}`);
    }

    // Settle the payment in our database (fund allocation + membership extension)
    await settle({
      db,
      orgId,
      personId,
      paymentId,
      amount: amount || payment.amount,
    });

    // [FIX-001] Flip the pending row to completed (so it appears in the ledger,
    // dashboards, and reports). Idempotent: skip if already completed.
    if (payment.status !== 'completed' && payment.status !== 'confirmed') {
      await duesRepo.updatePaymentStatus(paymentId, payment.status, 'completed', {
        paidAt: new Date(),
      }, personId);
    }

    // [FIX-001] Mark the linked invoice paid so the join→pay→active funnel
    // completes. Non-fatal if the invoice is already paid.
    if (payment.invoiceId) {
      try {
        const invoiceRepo = new DuesInvoiceRepository(db);
        const invoice = await invoiceRepo.findOneById(payment.invoiceId);
        if (invoice && invoice.status !== 'paid') {
          await invoiceRepo.markPaid(payment.invoiceId, invoice.version, paymentId, new Date());
        }
      } catch (err) {
        logger.warn(
          { paymentId, invoiceId: payment.invoiceId, error: err instanceof Error ? err.message : String(err) },
          'Online payment settled but invoice mark-paid failed (non-fatal)',
        );
      }
    }

    logger.info(
      { paymentIntentId, orgId, personId, amount, paymentId },
      'Payment settled successfully',
    );

    return { success: true };
  };
}
