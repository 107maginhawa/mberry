/**
 * sendPaymentLink — Officer generates a one-tap payment link for a member.
 *
 * POST /org/:organizationId/payments/send-link
 * Auth: officer (treasurer, president, admin)
 * Request: { personId, amount?, invoiceId? }
 * Response: { token, paymentUrl, expiresAt }
 */

import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import {
  generatePaymentToken,
  defaultPaymentTokenExpiry,
  getPaymentTokenSecret,
} from './utils/payment-token';

export async function sendPaymentLink(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId') ?? ctx.req.param('organizationId');
  if (!orgId) {
    return ctx.json({ error: 'Organization context required' }, 403);
  }

  const db = ctx.get('database');

  const body = await ctx.req.json();
  const { personId, amount: providedAmount, invoiceId } = body as {
    personId?: string;
    amount?: number;
    invoiceId?: string;
  };

  if (!personId) {
    return ctx.json({ error: 'personId is required' }, 400);
  }

  // Determine amount: use provided or fall back to org dues config
  let amount = providedAmount;
  let currency = 'PHP';

  if (!amount) {
    const duesRepo = new DuesRepository(db);
    const config = await duesRepo.getConfig(orgId);
    if (!config) {
      return ctx.json({ error: 'No amount provided and no dues configuration found for this organization' }, 400);
    }
    amount = config.defaultAmount;
    currency = config.currency;
  }

  // Generate HMAC token
  const secret = getPaymentTokenSecret();
  const { raw, hash } = generatePaymentToken(secret);
  const expiresAt = defaultPaymentTokenExpiry();

  // Store token hash in database
  const tokenRepo = new PaymentTokenRepository(db);
  await tokenRepo.create({
    tokenHash: hash,
    personId,
    organizationId: orgId,
    invoiceId: invoiceId || null,
    amount,
    currency,
    expiresAt,
    createdByOfficer: user.id,
  });

  return ctx.json({
    token: raw,
    paymentUrl: `/pay/${raw}`,
    expiresAt: expiresAt.toISOString(),
  }, 201);
}
