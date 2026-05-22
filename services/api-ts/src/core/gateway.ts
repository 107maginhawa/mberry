/**
 * Payment Gateway Adapter Interface (M6-R12)
 *
 * Abstract interface for payment gateway providers (Stripe, PayMongo, etc.)
 * Enables per-org credential isolation (BR-30) and test mode toggle.
 */

import type { Logger } from 'pino';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Gateway adapter interface (M6-R12)
// ---------------------------------------------------------------------------

/** Credentials scoped to a single organization */
export interface GatewayCredentials {
  organizationId: string;
  provider: GatewayProvider;
  /** Encrypted secret key */
  secretKey: string;
  /** Encrypted webhook secret */
  webhookSecret?: string;
  /** true = sandbox/test keys, false = live keys */
  testMode: boolean;
  /** Optional custom API URL (for local mock servers) */
  apiUrl?: string;
}

export type GatewayProvider = 'stripe' | 'paymongo';

/** Result of creating a connect/merchant account */
export interface ConnectAccountResult {
  accountId: string;
  onboardingUrl: string;
}

/** Result of creating a payment intent */
export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
  checkoutUrl?: string;
}

/** Result of capturing a payment */
export interface CaptureResult {
  paymentIntentId: string;
  status: string;
  chargeId: string;
  transferId?: string;
}

/** Result of cancelling a payment */
export interface CancelResult {
  paymentIntentId: string;
  status: string;
}

/** Result of creating a refund */
export interface RefundResult {
  refundId: string;
  status: string;
  amount: number;
}

/** Connect account status */
export interface ConnectAccountStatus {
  status: 'pending' | 'active' | 'restricted';
  onboardingComplete: boolean;
  dashboardUrl?: string;
}

/** Payment intent details */
export interface PaymentIntentDetails {
  id: string;
  status: string;
  amount: number;
  currency: string;
  charges: Array<{ id: string; status: string; amount: number }>;
}

/**
 * PaymentGateway — the adapter interface all providers must implement.
 *
 * Each method receives only provider-agnostic data.
 * The concrete adapter translates to provider-specific SDK calls.
 */
export interface PaymentGateway {
  readonly provider: GatewayProvider;

  createConnectAccount(data: {
    email?: string;
    country?: string;
    businessType: 'individual' | 'company';
    refreshUrl: string;
    returnUrl: string;
    metadata?: Record<string, string>;
  }): Promise<ConnectAccountResult>;

  generateOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<{ onboardingUrl: string }>;

  getConnectAccountStatus(accountId: string): Promise<ConnectAccountStatus>;

  createPaymentIntent(data: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    connectedAccountId: string;
    platformFeeAmount: number;
    description?: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<PaymentIntentResult>;

  capturePaymentIntent(
    paymentIntentId: string,
    connectedAccountId: string,
    metadata?: Record<string, string>,
  ): Promise<CaptureResult>;

  cancelPaymentIntent(
    paymentIntentId: string,
    connectedAccountId: string,
    reason?: string,
  ): Promise<CancelResult>;

  createRefund(data: {
    paymentIntentId: string;
    amount?: number;
    reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
    metadata?: Record<string, string>;
    connectedAccountId: string;
  }): Promise<RefundResult>;

  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
  ): Promise<unknown>; // provider-specific event type

  getPaymentIntent(
    paymentIntentId: string,
    connectedAccountId: string,
  ): Promise<PaymentIntentDetails>;
}

// ---------------------------------------------------------------------------
// Credential encryption helpers (BR-30)
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive a 256-bit key from the app-level encryption secret.
 * Uses a static salt so the same secret always produces the same key.
 */
function deriveKey(secret: string): Buffer {

  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext credential string.
 * Returns a base64 string of `iv:ciphertext:tag`.
 */
export function encryptCredential(plaintext: string, encryptionSecret: string): string {

  const key = deriveKey(encryptionSecret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * Decrypt a credential string produced by `encryptCredential`.
 */
export function decryptCredential(ciphertext: string, encryptionSecret: string): string {

  const key = deriveKey(encryptionSecret);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// Gateway registry — resolves per-org credentials to gateway instances
// ---------------------------------------------------------------------------

export class GatewayRegistry {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'gateway-registry' });
  }

  /**
   * Resolve a PaymentGateway for the given credentials.
   * Credentials are decrypted and injected into the concrete adapter.
   */
  resolve(credentials: GatewayCredentials, encryptionSecret: string): PaymentGateway {
    const _decryptedKey = decryptCredential(credentials.secretKey, encryptionSecret);
    const _decryptedWebhookSecret = credentials.webhookSecret
      ? decryptCredential(credentials.webhookSecret, encryptionSecret)
      : undefined;

    switch (credentials.provider) {
      case 'stripe':
        // Dynamically import would be ideal, but for now we just assert the shape.
        // The BillingService already implements the PaymentGateway interface.
        throw new Error('Stripe adapter: use BillingService directly (migration in progress)');
      case 'paymongo':
        throw new Error('PayMongo adapter not yet implemented');
      default:
        throw new Error(`Unknown gateway provider: ${credentials.provider}`);
    }
  }

  /**
   * Validate that credentials belong to the correct organization.
   * BR-30: prevents cross-org credential leakage.
   */
  validateOrgOwnership(credentials: GatewayCredentials, requestingOrgId: string): void {
    if (credentials.organizationId !== requestingOrgId) {
      this.logger.error(
        { credentialOrg: credentials.organizationId, requestingOrg: requestingOrgId },
        'BR-30 VIOLATION: cross-org credential access attempted'
      );
      throw new Error('Credential access denied: organization mismatch');
    }
  }
}
