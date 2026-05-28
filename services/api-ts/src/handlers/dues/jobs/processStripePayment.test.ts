import { describe, test, expect, mock } from 'bun:test';
import { createProcessPayment } from './processStripePayment';

// Mock settle-payment module
const mockSettlePayment = mock(() => Promise.resolve({
  fundAllocations: [{ fundName: 'general', amount: 5000 }],
  membershipExtendedFrom: '2026-01-01',
  membershipExtendedTo: '2027-01-01',
}));

mock.module('../../association:member/utils/settle-payment', () => ({
  settlePayment: mockSettlePayment,
}));

function createMockBilling() {
  return {
    capturePaymentIntent: mock(() => Promise.resolve({
      paymentIntentId: 'pi_123',
      status: 'succeeded',
      chargeId: 'ch_123',
    })),
    verifyWebhookSignature: mock(),
    createPaymentIntent: mock(),
    cancelPaymentIntent: mock(),
    createRefund: mock(),
    getPaymentIntent: mock(),
    createConnectAccount: mock(),
    generateOnboardingLink: mock(),
    getConnectAccountStatus: mock(),
  } as any;
}

function createMockLogger() {
  return {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
    child: mock(() => createMockLogger()),
  } as any;
}

const mockDb = {} as any;

describe('createProcessPayment', () => {
  test('settles payment for payment_intent.succeeded event', async () => {
    const billing = createMockBilling();
    const logger = createMockLogger();

    const processPayment = createProcessPayment(billing, mockDb, logger);

    const result = await processPayment({
      id: 'pi_test_123',
      status: 'succeeded',
      amount: 5000,
      metadata: {
        orgId: 'org-1',
        personId: 'person-1',
        paymentId: 'pay-1',
      },
    });

    expect(result).toEqual({ success: true });
    // Should NOT capture (already succeeded)
    expect(billing.capturePaymentIntent).not.toHaveBeenCalled();
    // Should settle
    expect(mockSettlePayment).toHaveBeenCalledWith({
      db: mockDb,
      orgId: 'org-1',
      personId: 'person-1',
      paymentId: 'pay-1',
      amount: 5000,
    });
  });

  test('captures and settles for requires_capture event', async () => {
    const billing = createMockBilling();
    const logger = createMockLogger();

    const processPayment = createProcessPayment(billing, mockDb, logger);

    const result = await processPayment({
      id: 'pi_test_456',
      status: 'requires_capture',
      amount: 10000,
      metadata: {
        orgId: 'org-2',
        personId: 'person-2',
        connectedAccountId: 'acct_test',
      },
    });

    expect(result).toEqual({ success: true });
    expect(billing.capturePaymentIntent).toHaveBeenCalledWith('pi_test_456', 'acct_test');
  });

  test('throws on missing metadata', async () => {
    const billing = createMockBilling();
    const logger = createMockLogger();

    const processPayment = createProcessPayment(billing, mockDb, logger);

    await expect(
      processPayment({ id: 'pi_no_meta', status: 'succeeded', amount: 100 }),
    ).rejects.toThrow('Missing metadata');
  });

  test('throws on missing required metadata fields', async () => {
    const billing = createMockBilling();
    const logger = createMockLogger();

    const processPayment = createProcessPayment(billing, mockDb, logger);

    await expect(
      processPayment({
        id: 'pi_bad_meta',
        status: 'succeeded',
        amount: 100,
        metadata: { someField: 'value' },
      }),
    ).rejects.toThrow('Missing required metadata fields');
  });

  test('throws on missing payment intent ID', async () => {
    const billing = createMockBilling();
    const logger = createMockLogger();

    const processPayment = createProcessPayment(billing, mockDb, logger);

    await expect(
      processPayment({ status: 'succeeded', metadata: { orgId: 'o', personId: 'p' } }),
    ).rejects.toThrow('Missing payment intent ID');
  });

  test('propagates settlement errors', async () => {
    const billing = createMockBilling();
    const logger = createMockLogger();
    mockSettlePayment.mockImplementationOnce(() => Promise.reject(new Error('DB connection failed')));

    const processPayment = createProcessPayment(billing, mockDb, logger);

    await expect(
      processPayment({
        id: 'pi_fail',
        status: 'succeeded',
        amount: 100,
        metadata: { orgId: 'org-1', personId: 'person-1' },
      }),
    ).rejects.toThrow('DB connection failed');
  });
});
