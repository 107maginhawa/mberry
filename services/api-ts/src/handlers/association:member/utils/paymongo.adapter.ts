/**
 * PayMongo gateway adapter for Philippine payment methods.
 * Supports GCash, Maya, card, and bank transfer.
 *
 * API docs: https://developers.paymongo.com/reference
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { ExternalServiceError } from '@/core/errors';
import type {
  GatewayAdapter,
  CheckoutOpts,
  CheckoutResult,
  PaymentStatusResult,
  WebhookEvent,
  PaymentStatus,
} from './gateway-adapter';

export class PayMongoAdapter implements GatewayAdapter {
  readonly name = 'paymongo';
  readonly supportedMethods = ['gcash', 'maya', 'card', 'bankTransfer'];

  constructor(
    private secretKey: string,
    private webhookSecret: string,
  ) {}

  async createCheckout(opts: CheckoutOpts): Promise<CheckoutResult> {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{
              name: opts.description,
              amount: opts.amount, // Already in centavos
              currency: opts.currency,
              quantity: 1,
            }],
            payment_method_types: this.supportedMethods,
            success_url: opts.successUrl,
            cancel_url: opts.cancelUrl,
            metadata: opts.metadata,
            send_email_receipt: true,
            billing: { email: opts.email },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ExternalServiceError(`PayMongo checkout failed: ${error}`, 'PayMongo', 'createCheckout');
    }

    const data = await response.json() as Record<string, unknown>;
    const dataObj = data['data'] as Record<string, unknown>;
    const attrs = dataObj['attributes'] as Record<string, unknown>;
    return {
      checkoutUrl: attrs['checkout_url'] as string,
      sessionId: dataObj['id'] as string,
    };
  }

  verifyWebhook(body: string, signature: string): WebhookEvent | null {
    // PayMongo signature format: t=timestamp,te=test_sig,li=live_sig
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const liveSig = parts.find(p => p.startsWith('li='))?.slice(3);
    const testSig = parts.find(p => p.startsWith('te='))?.slice(3);

    const sig = liveSig || testSig;
    if (!timestamp || !sig) return null;

    // Validate hex format before Buffer.from to prevent silent truncation
    if (!/^[0-9a-f]{64}$/i.test(sig)) return null;

    const payload = `${timestamp}.${body}`;
    const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

    try {
      const event = JSON.parse(body);
      const attrs = event.data?.attributes;
      if (!attrs) return null;

      return {
        type: attrs.type,
        gatewayEventId: event.data.id,
        sessionId: attrs.data?.attributes?.checkout_session_id || '',
        status: mapPayMongoStatus(attrs.data?.attributes?.status),
        amount: attrs.data?.attributes?.amount || 0,
        currency: attrs.data?.attributes?.currency || 'PHP',
        metadata: attrs.data?.attributes?.metadata || {},
      };
    } catch {
      return null;
    }
  }

  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      headers: {
        'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
      },
    });

    if (!response.ok) {
      throw new ExternalServiceError(`PayMongo status check failed: ${response.status}`, 'PayMongo', 'getPaymentStatus');
    }

    // PayMongo external API — deeply nested untyped response
    interface PayMongoAttrs {
      status?: string;
      payment_intent?: { attributes: { status: string } };
      payments?: Array<{ id: string; attributes: { paid_at: number } }>;
      line_items?: Array<{ amount: number; currency: string }>;
    }
    const data = await response.json() as { data: { attributes: PayMongoAttrs } };
    const attrs = data.data.attributes;
    const payment = attrs.payments?.[0];

    return {
      status: mapPayMongoStatus(attrs.payment_intent?.attributes?.status || attrs.status || ''),
      gatewayEventId: payment?.id || sessionId,
      paidAt: payment?.attributes?.paid_at ? new Date(payment.attributes.paid_at * 1000) : undefined,
      amount: attrs.line_items?.[0]?.amount || 0,
      currency: attrs.line_items?.[0]?.currency || 'PHP',
    };
  }
}

function mapPayMongoStatus(status: string): PaymentStatus {
  switch (status) {
    case 'paid':
    case 'succeeded':
      return 'paid';
    case 'awaiting_payment_method':
    case 'awaiting_next_action':
    case 'processing':
      return 'pending';
    case 'expired':
      return 'expired';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}
