/**
 * validatePaymentToken — Public token validation for one-tap payment.
 *
 * GET /pay/:token/validate
 * Auth: NONE (public endpoint, member clicks from email)
 * Response: { valid, invoiceId, amount, currency, memberName, orgName, dueDate }
 *   or { valid: false, error: "..." }
 *   or { valid: false, status: "already_paid" }
 */

import type { ValidatedContext } from '@/types/app';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import {
  hashPaymentToken,
  isPaymentTokenExpired,
  getPaymentTokenSecret,
} from './utils/payment-token';

export async function validatePaymentToken(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const rawToken = ctx.req.param('token');
  if (!rawToken) {
    return ctx.json({ valid: false, error: 'Token is required' }, 200);
  }

  const secret = getPaymentTokenSecret();
  const tokenHash = hashPaymentToken(rawToken, secret);

  const db = ctx.get('database');
  const tokenRepo = new PaymentTokenRepository(db);
  const result = await tokenRepo.findByTokenHashWithDetails(tokenHash);

  if (!result) {
    return ctx.json({ valid: false, error: 'Payment link is invalid or has been revoked' }, 200);
  }

  const { token, memberName, orgName } = result;

  // Check if already used
  if (token.usedAt) {
    return ctx.json({ valid: false, status: 'already_paid', error: 'This payment has already been completed' }, 200);
  }

  // Check expiry
  if (isPaymentTokenExpired(token.expiresAt)) {
    return ctx.json({ valid: false, error: 'This payment link has expired. Please request a new one from your organization.' }, 200);
  }

  return ctx.json({
    valid: true,
    invoiceId: token.invoiceId,
    amount: token.amount,
    currency: token.currency,
    memberName,
    orgName,
    dueDate: token.expiresAt.toISOString(),
  }, 200);
}
