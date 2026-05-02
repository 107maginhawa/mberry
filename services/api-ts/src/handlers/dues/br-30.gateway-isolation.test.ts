import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getGatewayConfig } from './getGatewayConfig';
import { recordPayment } from './recordPayment';
import { DuesRepository } from './repos/dues.repo';

/**
 * [BR-30] Payment Gateway Isolation
 *
 * Two entirely separate gateway accounts:
 * - Platform Gateway: used by Memberry to bill associations (subscription)
 * - Org Gateway: used by each org to collect dues from members
 *
 * These are NEVER shared or co-mingled. An org's gateway credentials cannot
 * be used for platform billing and vice versa. Each org configures and owns
 * its own gateway account independently.
 *
 * Edge case: An org without a gateway can still operate — online payment
 * collection unavailable, manual recording (BR-06) remains functional.
 */

// ─── Fixtures ───────────────────────────────────────────

const orgAGateway = {
  id: 'gw-a',
  organizationId: 'org-A',
  provider: 'paymongo',
  publicKey: 'pk_test_org_a',
  encryptedSecret: 'enc_org_a',
  connected: true,
  lastTestAt: new Date(),
};

const orgBGateway = {
  id: 'gw-b',
  organizationId: 'org-B',
  provider: 'stripe',
  publicKey: 'pk_test_org_b',
  encryptedSecret: 'enc_org_b',
  connected: true,
  lastTestAt: new Date(),
};

const fakePayment = {
  id: 'pay-1',
  organizationId: 'org-A',
  personId: 'person-1',
  receiptNumber: 'ORGA-2026-000001',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'cash',
  status: 'completed',
  refundedAmount: 0,
  recordedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-30] Payment Gateway Isolation', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('gateway config is scoped to org — org A gets org A config', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async (orgId: string) => {
        if (orgId === 'org-A') return orgAGateway;
        if (orgId === 'org-B') return orgBGateway;
        return undefined;
      },
    });

    const ctx = makeCtx({ _params: { orgId: 'org-A' } });
    const response = await getGatewayConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.provider).toBe('paymongo');
  });

  test('gateway config is scoped to org — org B gets org B config', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async (orgId: string) => {
        if (orgId === 'org-A') return orgAGateway;
        if (orgId === 'org-B') return orgBGateway;
        return undefined;
      },
    });

    const ctx = makeCtx({ _params: { orgId: 'org-B' } });
    const response = await getGatewayConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.provider).toBe('stripe');
  });

  test('org without gateway returns connected=false', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-no-gateway' } });
    const response = await getGatewayConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.connected).toBe(false);
  });

  test('[BR-30 edge] org without gateway can still record manual payments', async () => {
    // This verifies that recordPayment works without any gateway config
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-no-gateway',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash', // manual method — no gateway needed
      },
    });

    const response = await recordPayment(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.paymentMethod).toBe('cash');
  });

  test('gateway secret is never exposed in API response', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => orgAGateway,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-A' } });
    const response = await getGatewayConfig(ctx);

    // Secret key must never be in the response
    expect(response.body.data.encryptedSecret).toBeUndefined();
    expect(response.body.data.secretKey).toBeUndefined();
    // Public key only returns last 4 chars
    expect(response.body.data.publicKey).toBeUndefined();
    expect(response.body.data.publicKeyLast4).toBe('rg_a');
  });
});
