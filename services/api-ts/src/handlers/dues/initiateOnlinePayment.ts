import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';
import { formatReceiptNumber } from './utils/receipt-number';

/**
 * initiateOnlinePayment (handlers/dues/)
 *
 * Member initiates an online dues payment. Flow:
 * 1. Validate gateway config exists for org
 * 2. Create pending payment record with receipt number
 * 3. Return gateway redirect URL (Stripe/PayMongo)
 *
 * The actual settlement happens via webhook (handleStripeWebhook)
 * which calls settlePayment to extend membership.
 */
export async function initiateOnlinePayment(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  // [M6-R12] Verify gateway is configured for this org
  const gatewayConfig = await repo.getGatewayConfig(orgId);
  if (!gatewayConfig || !gatewayConfig.connected) {
    throw new BusinessLogicError(
      'Online payment not available: organization has not configured a payment gateway',
      'GATEWAY_NOT_CONFIGURED'
    );
  }

  // Validate amount
  const amount = body.amount;
  if (!amount || amount <= 0) {
    throw new BusinessLogicError('Payment amount must be positive', 'INVALID_AMOUNT');
  }

  // Generate receipt number
  const year = new Date().getFullYear();
  const sequence = await repo.getNextReceiptSequence(orgId, year);
  const receiptNumber = formatReceiptNumber('ORG', year, sequence);

  // Create pending payment record
  const payment = await repo.createPayment({
    organizationId: orgId,
    personId: user.id,
    receiptNumber,
    amount,
    currency: body.currency ?? 'PHP',
    paymentMethod: 'online',
    referenceNumber: null,
    status: 'pending',
    recordedBy: user.id,
    paidAt: null as unknown as Date,
    createdBy: session?.user?.id ?? user.id,
    updatedBy: session?.user?.id ?? user.id,
  });

  // Build redirect URL — gateway-specific
  const provider = (gatewayConfig as Record<string, unknown>)['provider'] as string ?? 'stripe';
  const successUrl = body.successUrl ?? `${body.baseUrl ?? ''}/payments/success?paymentId=${payment.id}`;
  const cancelUrl = body.cancelUrl ?? `${body.baseUrl ?? ''}/payments/cancel?paymentId=${payment.id}`;

  return ctx.json({
    paymentId: payment.id,
    receiptNumber,
    status: 'pending',
    provider,
    redirectUrl: successUrl, // In production, this would be the Stripe Checkout URL
    metadata: {
      amount,
      currency: payment.currency,
      successUrl,
      cancelUrl,
    },
  }, 201);
}
