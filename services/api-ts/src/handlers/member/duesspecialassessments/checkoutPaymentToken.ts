/**
 * checkoutPaymentToken — Initiate Stripe checkout for one-tap payment.
 *
 * POST /pay/:token/checkout
 * Auth: NONE (public endpoint, member clicks from email)
 * Response: { checkoutUrl }
 *
 * Validates token, creates Stripe checkout session, marks token as used.
 * Double-pay prevention: token is single-use (usedAt set on checkout initiation).
 */

import type { ValidatedContext } from '@/types/app';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { formatReceiptNumber } from '@/handlers/association:member/utils/receipt-number';
import {
  hashPaymentToken,
  isPaymentTokenExpired,
  getPaymentTokenSecret,
} from './utils/payment-token';

export async function checkoutPaymentToken(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const rawToken = ctx.req.param('token');
  if (!rawToken) {
    return ctx.json({ error: 'Token is required' }, 400);
  }

  const secret = getPaymentTokenSecret();
  const tokenHash = hashPaymentToken(rawToken, secret);

  const db = ctx.get('database');
  const tokenRepo = new PaymentTokenRepository(db);
  const tokenRecord = await tokenRepo.findByTokenHash(tokenHash);

  if (!tokenRecord) {
    return ctx.json({ error: 'Payment link is invalid or has been revoked' }, 400);
  }

  // Check if already used (double-pay prevention)
  if (tokenRecord.usedAt) {
    return ctx.json({ error: 'This payment has already been processed' }, 400);
  }

  // Check expiry
  if (isPaymentTokenExpired(tokenRecord.expiresAt)) {
    return ctx.json({ error: 'This payment link has expired. Please request a new one.' }, 400);
  }

  // Look up gateway config for the org
  const duesRepo = new DuesRepository(db);
  const gatewayConfig = await duesRepo.getGatewayConfig(tokenRecord.organizationId);
  if (!gatewayConfig || !gatewayConfig.connected) {
    return ctx.json({ error: 'Online payment is not configured for this organization' }, 400);
  }

  // Create Stripe checkout session via billing service
  const billing = ctx.get('billing');
  if (!billing) {
    return ctx.json({ error: 'Billing service not available' }, 400);
  }

  try {
    // [FIX-001] Create the pending DuesPayment ledger row BEFORE the checkout
    // session, and carry its real id as `metadata.paymentId`. Previously the
    // checkout created no row and the webhook had no `paymentId` to settle, so
    // online payments charged money but left no ledger record. The webhook
    // (createProcessPayment) reads `metadata.paymentId` to settle the exact row.
    const year = new Date().getFullYear();
    const orgPrefix = await duesRepo.getOrgReceiptPrefix(tokenRecord.organizationId);
    const sequence = await duesRepo.getNextReceiptSequence(tokenRecord.organizationId, year);
    const receiptNumber = formatReceiptNumber(orgPrefix, year, sequence);

    const pendingPayment = await duesRepo.createPayment({
      organizationId: tokenRecord.organizationId,
      personId: tokenRecord.personId,
      invoiceId: tokenRecord.invoiceId || null,
      receiptNumber,
      amount: tokenRecord.amount,
      currency: tokenRecord.currency,
      paymentMethod: 'online',
      status: 'pending',
      recordedBy: tokenRecord.personId,
      paidAt: null as unknown as Date,
      createdBy: tokenRecord.personId,
      updatedBy: tokenRecord.personId,
    });

    const publicUrl = process.env['SERVER_PUBLIC_URL'] || process.env['PUBLIC_URL'] || 'http://localhost:3004';
    const result = await billing.createPaymentIntent({
      amount: tokenRecord.amount,
      currency: tokenRecord.currency.toLowerCase(),
      connectedAccountId: gatewayConfig.publicKey || '', // Stripe connected account
      platformFeeAmount: 0,
      description: `Dues payment - ${tokenRecord.currency} ${(tokenRecord.amount / 100).toFixed(2)}`,
      successUrl: `${publicUrl}/pay/${rawToken}?status=success`,
      cancelUrl: `${publicUrl}/pay/${rawToken}?status=cancelled`,
      metadata: {
        // The webhook settles by `paymentId` — this is the load-bearing field.
        paymentId: pendingPayment.id,
        paymentTokenId: tokenRecord.id,
        personId: tokenRecord.personId,
        // Both orgId and organizationId for webhook compatibility (it reads either).
        orgId: tokenRecord.organizationId,
        organizationId: tokenRecord.organizationId,
        invoiceId: tokenRecord.invoiceId || '',
      },
    });

    // Mark token as used AFTER successful checkout session creation
    await tokenRepo.markUsed(tokenRecord.id);

    return ctx.json({
      checkoutUrl: result.checkoutUrl || `https://checkout.stripe.com/pay/${result.clientSecret}`,
    }, 200);
  } catch (error) {
    return ctx.json({
      error: 'Failed to create checkout session. Please try again.',
    }, 500);
  }
}
