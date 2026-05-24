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
import { PaymentTokenRepository } from './repos/payment-token.repo';
import { DuesRepository } from '../association:member/repos/dues-payments.repo';
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
  if (!gatewayConfig || !(gatewayConfig as any).connected) {
    return ctx.json({ error: 'Online payment is not configured for this organization' }, 400);
  }

  // Create Stripe checkout session via billing service
  const billing = ctx.get('billing');
  if (!billing) {
    return ctx.json({ error: 'Billing service not available' }, 400);
  }

  try {
    const publicUrl = process.env['SERVER_PUBLIC_URL'] || process.env['PUBLIC_URL'] || 'http://localhost:3004';
    const result = await billing.createPaymentIntent({
      amount: tokenRecord.amount,
      currency: tokenRecord.currency.toLowerCase(),
      connectedAccountId: (gatewayConfig as any).publicKey || '', // Stripe connected account
      platformFeeAmount: 0,
      description: `Dues payment - ${tokenRecord.currency} ${(tokenRecord.amount / 100).toFixed(2)}`,
      successUrl: `${publicUrl}/pay/${rawToken}?status=success`,
      cancelUrl: `${publicUrl}/pay/${rawToken}?status=cancelled`,
      metadata: {
        paymentTokenId: tokenRecord.id,
        personId: tokenRecord.personId,
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
