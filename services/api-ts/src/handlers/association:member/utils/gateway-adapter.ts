/**
 * Payment gateway adapter interface.
 * Abstracts PayMongo/Stripe behind a common contract.
 */

export interface CheckoutOpts {
  /** Amount in minor currency units (centavos) */
  amount: number;
  currency: string;
  description: string;
  /** Member email for receipt */
  email: string;
  /** Metadata attached to the checkout session */
  metadata: Record<string, string>;
  /** URL to redirect after success */
  successUrl: string;
  /** URL to redirect after cancel */
  cancelUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface PaymentStatusResult {
  status: PaymentStatus;
  gatewayEventId: string;
  paidAt?: Date;
  amount: number;
  currency: string;
  /** The session's hosted checkout url, when the session is still live (reuse path). */
  checkoutUrl?: string;
}

export interface WebhookEvent {
  type: string;
  gatewayEventId: string;
  sessionId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

export interface GatewayAdapter {
  readonly name: string;
  readonly supportedMethods: string[];

  /**
   * Create a checkout session and return the redirect URL.
   * `idempotencyKey` (when supported) makes a retried create return the same
   * session instead of a new one — the double-tap / lost-response guard.
   */
  createCheckout(opts: CheckoutOpts, idempotencyKey?: string): Promise<CheckoutResult>;

  /** Verify webhook signature and parse the event */
  verifyWebhook(body: string, signature: string): WebhookEvent | null;

  /** Check payment status for a session */
  getPaymentStatus(sessionId: string): Promise<PaymentStatusResult>;
}
