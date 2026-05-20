/**
 * Tests for gateway adapter interface (M6-R12) and credential isolation (BR-30).
 *
 * Covers:
 *  - PaymentGateway interface contract
 *  - Credential encryption/decryption round-trip
 *  - BR-30: cross-org credential leakage prevention
 *  - Test mode isolation
 *  - GatewayRegistry org ownership validation
 */

import { describe, test, expect } from 'bun:test';
import {
  encryptCredential,
  decryptCredential,
  GatewayRegistry,
  type PaymentGateway,
  type GatewayCredentials,
  type GatewayProvider,
} from './gateway';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENCRYPTION_SECRET = 'test-secret-key-for-unit-tests-32';

const fakeLogger = {
  child: () => fakeLogger,
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as any;

function makeCredentials(overrides: Partial<GatewayCredentials> = {}): GatewayCredentials {
  return {
    organizationId: 'org-1',
    provider: 'stripe' as GatewayProvider,
    secretKey: encryptCredential('sk_test_abc123', ENCRYPTION_SECRET),
    webhookSecret: encryptCredential('whsec_test_xyz', ENCRYPTION_SECRET),
    testMode: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// M6-R12: Gateway adapter interface type checks
// ---------------------------------------------------------------------------

describe('PaymentGateway interface (M6-R12)', () => {
  test('interface requires all payment methods', () => {
    // Compile-time check: a mock that satisfies the full interface
    const mockGateway: PaymentGateway = {
      provider: 'stripe',
      createConnectAccount: async () => ({ accountId: 'acct_1', onboardingUrl: 'https://...' }),
      generateOnboardingLink: async () => ({ onboardingUrl: 'https://...' }),
      getConnectAccountStatus: async () => ({ status: 'active', onboardingComplete: true }),
      createPaymentIntent: async () => ({
        paymentIntentId: 'pi_1',
        clientSecret: 'cs_1',
        status: 'requires_payment_method',
      }),
      capturePaymentIntent: async () => ({
        paymentIntentId: 'pi_1',
        status: 'succeeded',
        chargeId: 'ch_1',
      }),
      cancelPaymentIntent: async () => ({
        paymentIntentId: 'pi_1',
        status: 'canceled',
      }),
      createRefund: async () => ({
        refundId: 'rf_1',
        status: 'succeeded',
        amount: 1000,
      }),
      verifyWebhookSignature: async () => ({}),
      getPaymentIntent: async () => ({
        id: 'pi_1',
        status: 'succeeded',
        amount: 1000,
        currency: 'usd',
        charges: [],
      }),
    };

    // All methods exist and are callable
    expect(mockGateway.provider).toBe('stripe');
    expect(typeof mockGateway.createConnectAccount).toBe('function');
    expect(typeof mockGateway.generateOnboardingLink).toBe('function');
    expect(typeof mockGateway.getConnectAccountStatus).toBe('function');
    expect(typeof mockGateway.createPaymentIntent).toBe('function');
    expect(typeof mockGateway.capturePaymentIntent).toBe('function');
    expect(typeof mockGateway.cancelPaymentIntent).toBe('function');
    expect(typeof mockGateway.createRefund).toBe('function');
    expect(typeof mockGateway.verifyWebhookSignature).toBe('function');
    expect(typeof mockGateway.getPaymentIntent).toBe('function');
  });

  test('adapter supports multiple providers', () => {
    const stripeGateway: PaymentGateway = {
      provider: 'stripe',
      createConnectAccount: async () => ({ accountId: 'acct_stripe', onboardingUrl: 'https://stripe.com' }),
      generateOnboardingLink: async () => ({ onboardingUrl: 'https://stripe.com' }),
      getConnectAccountStatus: async () => ({ status: 'active', onboardingComplete: true }),
      createPaymentIntent: async () => ({ paymentIntentId: 'pi_s', clientSecret: 'cs', status: 'ok' }),
      capturePaymentIntent: async () => ({ paymentIntentId: 'pi_s', status: 'ok', chargeId: 'ch' }),
      cancelPaymentIntent: async () => ({ paymentIntentId: 'pi_s', status: 'canceled' }),
      createRefund: async () => ({ refundId: 'rf', status: 'ok', amount: 100 }),
      verifyWebhookSignature: async () => ({}),
      getPaymentIntent: async () => ({ id: 'pi', status: 'ok', amount: 100, currency: 'usd', charges: [] }),
    };

    const paymongoGateway: PaymentGateway = {
      provider: 'paymongo',
      createConnectAccount: async () => ({ accountId: 'pm_acct', onboardingUrl: 'https://paymongo.com' }),
      generateOnboardingLink: async () => ({ onboardingUrl: 'https://paymongo.com' }),
      getConnectAccountStatus: async () => ({ status: 'pending', onboardingComplete: false }),
      createPaymentIntent: async () => ({ paymentIntentId: 'pi_pm', clientSecret: 'cs', status: 'ok' }),
      capturePaymentIntent: async () => ({ paymentIntentId: 'pi_pm', status: 'ok', chargeId: 'ch' }),
      cancelPaymentIntent: async () => ({ paymentIntentId: 'pi_pm', status: 'canceled' }),
      createRefund: async () => ({ refundId: 'rf', status: 'ok', amount: 100 }),
      verifyWebhookSignature: async () => ({}),
      getPaymentIntent: async () => ({ id: 'pi', status: 'ok', amount: 100, currency: 'php', charges: [] }),
    };

    expect(stripeGateway.provider).toBe('stripe');
    expect(paymongoGateway.provider).toBe('paymongo');
  });
});

// ---------------------------------------------------------------------------
// BR-30: Credential encryption & isolation
// ---------------------------------------------------------------------------

describe('Credential encryption (BR-30)', () => {
  test('encrypt/decrypt round-trip produces original plaintext', () => {
    const plaintext = 'sk_live_superSecretKey123!@#';
    const encrypted = encryptCredential(plaintext, ENCRYPTION_SECRET);
    const decrypted = decryptCredential(encrypted, ENCRYPTION_SECRET);
    expect(decrypted).toBe(plaintext);
  });

  test('encrypted output differs from plaintext', () => {
    const plaintext = 'sk_test_abc';
    const encrypted = encryptCredential(plaintext, ENCRYPTION_SECRET);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });

  test('different secrets produce different ciphertexts', () => {
    const plaintext = 'sk_test_same_key';
    const enc1 = encryptCredential(plaintext, 'secret-aaa-32-chars-long-enough!');
    // Different secrets should not decrypt each other
    expect(() => decryptCredential(enc1, 'secret-bbb-32-chars-long-enough!')).toThrow();
  });

  test('decryption with wrong secret fails', () => {
    const encrypted = encryptCredential('sk_test_xyz', ENCRYPTION_SECRET);
    expect(() => decryptCredential(encrypted, 'wrong-secret-key-for-testing-!!!')).toThrow();
  });

  test('each encryption produces unique ciphertext (random IV)', () => {
    const plaintext = 'sk_test_same';
    const enc1 = encryptCredential(plaintext, ENCRYPTION_SECRET);
    const enc2 = encryptCredential(plaintext, ENCRYPTION_SECRET);
    // Random IV means each encryption is different
    expect(enc1).not.toBe(enc2);
    // But both decrypt to same value
    expect(decryptCredential(enc1, ENCRYPTION_SECRET)).toBe(plaintext);
    expect(decryptCredential(enc2, ENCRYPTION_SECRET)).toBe(plaintext);
  });

  test('handles empty string', () => {
    const encrypted = encryptCredential('', ENCRYPTION_SECRET);
    expect(decryptCredential(encrypted, ENCRYPTION_SECRET)).toBe('');
  });

  test('handles long keys', () => {
    const longKey = 'sk_live_' + 'x'.repeat(500);
    const encrypted = encryptCredential(longKey, ENCRYPTION_SECRET);
    expect(decryptCredential(encrypted, ENCRYPTION_SECRET)).toBe(longKey);
  });
});

// ---------------------------------------------------------------------------
// BR-30: Cross-org credential leakage prevention
// ---------------------------------------------------------------------------

describe('GatewayRegistry — org ownership (BR-30)', () => {
  test('validateOrgOwnership passes when orgs match', () => {
    const registry = new GatewayRegistry(fakeLogger);
    const creds = makeCredentials({ organizationId: 'org-alpha' });

    // Should not throw
    expect(() => registry.validateOrgOwnership(creds, 'org-alpha')).not.toThrow();
  });

  test('validateOrgOwnership rejects mismatched org (BR-30)', () => {
    const registry = new GatewayRegistry(fakeLogger);
    const creds = makeCredentials({ organizationId: 'org-alpha' });

    expect(() => registry.validateOrgOwnership(creds, 'org-beta')).toThrow(
      'Credential access denied: organization mismatch'
    );
  });

  test('cross-org credential access is blocked even with valid encryption', () => {
    const registry = new GatewayRegistry(fakeLogger);
    const orgACreds = makeCredentials({ organizationId: 'org-A' });
    const orgBCreds = makeCredentials({ organizationId: 'org-B' });

    // Org A cannot use Org B's credentials
    expect(() => registry.validateOrgOwnership(orgBCreds, 'org-A')).toThrow();
    // Org B cannot use Org A's credentials
    expect(() => registry.validateOrgOwnership(orgACreds, 'org-B')).toThrow();
    // Each org can use their own
    expect(() => registry.validateOrgOwnership(orgACreds, 'org-A')).not.toThrow();
    expect(() => registry.validateOrgOwnership(orgBCreds, 'org-B')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test mode isolation
// ---------------------------------------------------------------------------

describe('Test mode isolation', () => {
  test('credentials track test mode flag', () => {
    const testCreds = makeCredentials({ testMode: true });
    const liveCreds = makeCredentials({ testMode: false });

    expect(testCreds.testMode).toBe(true);
    expect(liveCreds.testMode).toBe(false);
  });

  test('test and live credentials are separate objects', () => {
    const testCreds = makeCredentials({
      organizationId: 'org-1',
      testMode: true,
      secretKey: encryptCredential('sk_test_xxx', ENCRYPTION_SECRET),
    });
    const liveCreds = makeCredentials({
      organizationId: 'org-1',
      testMode: false,
      secretKey: encryptCredential('sk_live_yyy', ENCRYPTION_SECRET),
    });

    const testKey = decryptCredential(testCreds.secretKey, ENCRYPTION_SECRET);
    const liveKey = decryptCredential(liveCreds.secretKey, ENCRYPTION_SECRET);

    expect(testKey).toBe('sk_test_xxx');
    expect(liveKey).toBe('sk_live_yyy');
    expect(testKey).not.toBe(liveKey);
  });

  test('test mode credentials cannot decrypt live mode data', () => {
    // Simulates scenario where test/live keys are encrypted with different secrets
    const testSecret = 'test-encryption-secret-aaa-32ch!';
    const liveSecret = 'live-encryption-secret-bbb-32ch!';

    const testEncrypted = encryptCredential('sk_test_key', testSecret);
    const liveEncrypted = encryptCredential('sk_live_key', liveSecret);

    // Cannot cross-decrypt
    expect(() => decryptCredential(testEncrypted, liveSecret)).toThrow();
    expect(() => decryptCredential(liveEncrypted, testSecret)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// GatewayRegistry.resolve
// ---------------------------------------------------------------------------

describe('GatewayRegistry.resolve', () => {
  test('throws for unknown provider', () => {
    const registry = new GatewayRegistry(fakeLogger);
    const creds = makeCredentials({ provider: 'unknown' as any });
    expect(() => registry.resolve(creds, ENCRYPTION_SECRET)).toThrow('Unknown gateway provider');
  });

  test('stripe provider throws migration message (adapter bridged through BillingService)', () => {
    const registry = new GatewayRegistry(fakeLogger);
    const creds = makeCredentials({ provider: 'stripe' });
    expect(() => registry.resolve(creds, ENCRYPTION_SECRET)).toThrow('use BillingService directly');
  });

  test('paymongo provider throws not-yet-implemented', () => {
    const registry = new GatewayRegistry(fakeLogger);
    const creds = makeCredentials({ provider: 'paymongo' });
    expect(() => registry.resolve(creds, ENCRYPTION_SECRET)).toThrow('not yet implemented');
  });
});
